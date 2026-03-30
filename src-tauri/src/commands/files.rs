use tauri::{command, AppHandle, Manager};
use serde::Serialize;
use std::fs;

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,   // always relative to instance root
    pub is_dir: bool,
    pub size: u64,
}

#[command]
pub async fn list_instance_files(
    app: AppHandle,
    instance_id: String,
    sub_path: Option<String>,
) -> Result<Vec<FileEntry>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let base = app_data.join("instances").join(&instance_id);

    let rel = sub_path.clone().unwrap_or_default();
    let target = if rel.is_empty() { base.clone() } else { base.join(&rel) };

    if !target.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<FileEntry> = fs::read_dir(&target)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            // Skip hidden files and instance metadata
            if name.starts_with('.') || name == "instance.json" {
                return None;
            }
            let meta = entry.metadata().ok()?;
            // Build relative path from instance root
            let relative_path = if rel.is_empty() {
                name.clone()
            } else {
                format!("{}/{}", rel, name)
            };
            Some(FileEntry {
                name,
                path: relative_path,
                is_dir: meta.is_dir(),
                size: if meta.is_file() { meta.len() } else { 0 },
            })
        })
        .collect();

    // Folders first, then alphabetical
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[command]
pub async fn open_in_finder(app: AppHandle, instance_id: String) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = app_data.join("instances").join(&instance_id);

    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn create_folder(
    app: AppHandle,
    instance_id: String,
    relative_path: String,
) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let target = app_data.join("instances").join(&instance_id).join(&relative_path);
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn delete_file(
    app: AppHandle,
    instance_id: String,
    relative_path: String,
) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let target = app_data.join("instances").join(&instance_id).join(&relative_path);

    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
    } else if target.is_file() {
        fs::remove_file(&target).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn install_mod(
    app: AppHandle,
    instance_id: String,
    mod_id: String,
    _source: String,
    mc_version: String,
    loader: String,
) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mods_dir = app_data.join("instances").join(&instance_id).join("mods");
    fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

    let url = format!("https://api.modrinth.com/v2/project/{}/version", mod_id);
    let client = reqwest::Client::new();
    let versions: Vec<serde_json::Value> = client
        .get(&url)
        .header("User-Agent", "ArgonMC/0.1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if versions.is_empty() {
        return Err("No versions found for this mod".to_string());
    }

    let version = versions
        .iter()
        .find(|v| {
            let gv = v.get("game_versions").and_then(|g| g.as_array());
            let lo = v.get("loaders").and_then(|l| l.as_array());
            let has_ver = gv.map_or(false, |a| a.iter().any(|g| g.as_str() == Some(&mc_version)));
            let has_ldr = lo.map_or(false, |a| a.iter().any(|l| l.as_str() == Some(&loader)));
            has_ver && has_ldr
        })
        .or_else(|| versions.first())
        .ok_or("No compatible version found")?;

    let files = version
        .get("files")
        .and_then(|f| f.as_array())
        .ok_or("No files found")?;

    let file = files
        .iter()
        .find(|f| f.get("primary").and_then(|p| p.as_bool()).unwrap_or(false))
        .or_else(|| files.first())
        .ok_or("No file found")?;

    let file_url = file.get("url").and_then(|u| u.as_str()).ok_or("No download URL")?;
    let filename  = file.get("filename").and_then(|f| f.as_str()).ok_or("No filename")?;

    let bytes = client
        .get(file_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    fs::write(mods_dir.join(filename), &bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn uninstall_mod(
    app: AppHandle,
    instance_id: String,
    filename: String,
) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mod_file = app_data
        .join("instances")
        .join(&instance_id)
        .join("mods")
        .join(&filename);
    if mod_file.exists() {
        fs::remove_file(&mod_file).map_err(|e| e.to_string())?;
    }
    Ok(())
}