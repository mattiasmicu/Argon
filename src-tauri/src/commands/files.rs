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

#[derive(Debug, Serialize)]
pub struct InstalledMod {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub version: String,
    pub enabled: bool,
    pub size: u64,
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

#[command]
pub async fn list_installed_mods(
    app: AppHandle,
    instance_id: String,
) -> Result<Vec<InstalledMod>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mods_dir = app_data.join("instances").join(&instance_id).join("mods");
    
    if !mods_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut mods = Vec::new();
    
    for entry in fs::read_dir(&mods_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let filename = entry.file_name().to_string_lossy().to_string();
        
        // Skip disabled mods (files starting with .)
        let enabled = !filename.starts_with('.');
        let display_name = if enabled { filename.clone() } else { filename.trim_start_matches('.').to_string() };
        
        // Try to extract version from filename (e.g., mod-1.2.3.jar -> 1.2.3)
        let version = extract_version(&display_name);
        
        // Extract mod name from filename (remove version and extension)
        let name = extract_mod_name(&display_name);
        
        mods.push(InstalledMod {
            id: filename.clone(),
            name,
            filename: display_name,
            version,
            enabled,
            size: metadata.len(),
        });
    }
    
    // Sort alphabetically by name
    mods.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    Ok(mods)
}

fn extract_version(filename: &str) -> String {
    // Try to find version pattern like -1.2.3 or _1.2.3 or +1.2.3
    let re = regex::Regex::new(r"[-_+](\d+\.\d+(?:\.\d+)?)").unwrap();
    if let Some(caps) = re.captures(filename) {
        if let Some(version) = caps.get(1) {
            return version.as_str().to_string();
        }
    }
    "Unknown".to_string()
}

fn extract_mod_name(filename: &str) -> String {
    // Remove common suffixes and extensions
    let name = filename
        .replace(".jar", "")
        .replace(".zip", "")
        .replace("-fabric", "")
        .replace("-forge", "")
        .replace("-quilt", "");
    
    // Try to remove version
    let re = regex::Regex::new(r"[-_+]?\d+\.\d+(?:\.\d+)?.*$").unwrap();
    let name = re.replace(&name, "").to_string();
    
    if name.is_empty() {
        filename.to_string()
    } else {
        name.replace(['-', '_'], " ")
    }
}

#[command]
pub async fn toggle_mod(
    app: AppHandle,
    instance_id: String,
    filename: String,
    enabled: bool,
) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mods_dir = app_data.join("instances").join(&instance_id).join("mods");
    
    let current_path = if enabled {
        // Enable: rename from .filename to filename
        mods_dir.join(format!(".{}", filename))
    } else {
        // Disable: rename from filename to .filename
        mods_dir.join(&filename)
    };
    
    let new_filename = if enabled {
        filename.clone()
    } else {
        format!(".{}", filename)
    };
    let new_path = mods_dir.join(&new_filename);
    
    if current_path.exists() {
        fs::rename(&current_path, &new_path).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[command]
pub async fn read_file_content(
    app: AppHandle,
    instance_id: String,
    relative_path: String,
) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let target = app_data
        .join("instances")
        .join(&instance_id)
        .join(&relative_path);
    
    if !target.exists() {
        return Err("File not found".to_string());
    }
    
    if !target.is_file() {
        return Err("Path is not a file".to_string());
    }
    
    // Read with size limit (10MB)
    let metadata = fs::metadata(&target).map_err(|e| e.to_string())?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err("File too large (>10MB)".to_string());
    }
    
    fs::read_to_string(&target).map_err(|e| e.to_string())
}