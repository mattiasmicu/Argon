use tauri::{command, AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct LoaderVersion {
    pub version: String,
    pub stable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FabricLoaderInfo {
    #[serde(rename = "loader")]
    pub loader: FabricLoader,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FabricLoader {
    pub version: String,
    pub stable: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct LoaderDownloadLog {
    pub message: String,
    pub level: String,
}

fn emit_log(app: &AppHandle, level: &str, msg: impl Into<String>) {
    let _ = app.emit("loader-log", LoaderDownloadLog {
        message: msg.into(),
        level: level.to_string(),
    });
}

#[command]
pub async fn get_loader_versions(loader: String, mc_version: String) -> Result<Vec<LoaderVersion>, String> {
    match loader.as_str() {
        "fabric" => get_fabric_versions(&mc_version).await,
        "quilt" => get_quilt_versions(&mc_version).await,
        "forge" | "neoforge" => get_forge_versions(&mc_version).await,
        _ => Err(format!("Unsupported loader: {}", loader)),
    }
}

async fn get_fabric_versions(mc_version: &str) -> Result<Vec<LoaderVersion>, String> {
    let url = format!(
        "https://meta.fabricmc.net/v2/versions/loader/{}",
        mc_version
    );
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let loaders: Vec<FabricLoaderInfo> = resp.json().await.map_err(|e| e.to_string())?;
    
    Ok(loaders.into_iter()
        .map(|l| LoaderVersion {
            version: l.loader.version,
            stable: l.loader.stable,
        })
        .collect())
}

async fn get_quilt_versions(mc_version: &str) -> Result<Vec<LoaderVersion>, String> {
    // Quilt uses a similar API structure to Fabric
    let url = format!(
        "https://meta.quiltmc.org/v3/versions/loader/{}",
        mc_version
    );
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let loaders: Vec<FabricLoaderInfo> = resp.json().await.map_err(|e| e.to_string())?;
    
    Ok(loaders.into_iter()
        .map(|l| LoaderVersion {
            version: l.loader.version,
            stable: l.loader.stable,
        })
        .collect())
}

async fn get_forge_versions(mc_version: &str) -> Result<Vec<LoaderVersion>, String> {
    // Forge uses Maven metadata
    let url = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
    let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    
    let mut versions = Vec::new();
    if let Some(promos) = data.get("promos") {
        for (key, value) in promos.as_object().unwrap_or(&serde_json::Map::new()) {
            if key.starts_with(&format!("{}-", mc_version)) {
                if let Some(version) = value.as_str() {
                    let full_version = format!("{}-{}", mc_version, version);
                    versions.push(LoaderVersion {
                        version: full_version,
                        stable: key.contains("recommended"),
                    });
                }
            }
        }
    }
    
    versions.sort_by(|a, b| b.stable.cmp(&a.stable));
    Ok(versions)
}

#[command]
pub async fn install_loader(
    app: AppHandle,
    instance_id: String,
    loader: String,
    mc_version: String,
    loader_version: String,
) -> Result<(), String> {
    emit_log(&app, "info", format!("Installing {} loader version {}", loader, loader_version));
    
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&instance_id);
    
    match loader.as_str() {
        "fabric" | "quilt" => {
            install_fabric_or_quilt(&app, &instance_dir, &loader, &mc_version, &loader_version).await
        }
        "forge" | "neoforge" => {
            install_forge(&app, &instance_dir, &mc_version, &loader_version).await
        }
        _ => Err(format!("Unsupported loader: {}", loader)),
    }
}

async fn install_fabric_or_quilt(
    app: &AppHandle,
    instance_dir: &PathBuf,
    loader: &str,
    mc_version: &str,
    loader_version: &str,
) -> Result<(), String> {
    let base_url = if loader == "fabric" {
        "https://meta.fabricmc.net"
    } else {
        "https://meta.quiltmc.org/v3"
    };
    
    // Fetch the loader profile
    let url = format!(
        "{}/v2/versions/loader/{}/{}/profile/json",
        base_url, mc_version, loader_version
    );
    
    emit_log(app, "info", format!("Fetching loader profile from {}", url));
    
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let profile: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    
    // Save the version JSON
    let version_id = format!("{}-{}-{}", loader, mc_version, loader_version);
    let version_dir = instance_dir.parent().unwrap().parent().unwrap().join("versions").join(&version_id);
    fs::create_dir_all(&version_dir).map_err(|e| e.to_string())?;
    
    let version_json_path = version_dir.join(format!("{}.json", version_id));
    fs::write(&version_json_path, serde_json::to_string_pretty(&profile).unwrap())
        .map_err(|e| e.to_string())?;
    
    // Download libraries
    if let Some(libraries) = profile.get("libraries").and_then(|l| l.as_array()) {
        emit_log(app, "info", format!("Downloading {} libraries...", libraries.len()));
        
        for lib in libraries {
            if let Some(url) = lib.get("url").and_then(|u| u.as_str()) {
                if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
                    download_library(app, name, url).await?;
                }
            }
        }
    }
    
    // Update instance.json with loader info
    let instance_json_path = instance_dir.join("instance.json");
    let instance_json = fs::read_to_string(&instance_json_path).map_err(|e| e.to_string())?;
    let mut instance: serde_json::Value = serde_json::from_str(&instance_json).map_err(|e| e.to_string())?;
    
    instance["loader_version"] = serde_json::Value::String(loader_version.to_string());
    instance["loader_version_id"] = serde_json::Value::String(version_id);
    
    fs::write(&instance_json_path, serde_json::to_string_pretty(&instance).unwrap())
        .map_err(|e| e.to_string())?;
    
    emit_log(app, "info", format!("{} loader installed successfully!", loader));
    Ok(())
}

async fn install_forge(
    app: &AppHandle,
    _instance_dir: &PathBuf,
    _mc_version: &str,
    _loader_version: &str,
) -> Result<(), String> {
    emit_log(app, "info", "Forge installation not yet implemented".to_string());
    Err("Forge installation not yet implemented".to_string())
}

async fn download_library(app: &AppHandle, name: &str, base_url: &str) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let libs_dir = app_data.join("libraries");
    
    let path = get_maven_path(name);
    let lib_path = libs_dir.join(&path);
    
    if lib_path.exists() {
        return Ok(());
    }
    
    if let Some(parent) = lib_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let url = format!("{}/{}", base_url, path.display());
    emit_log(app, "debug", format!("Downloading library: {}", name));
    
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    
    fs::write(&lib_path, &bytes).map_err(|e| e.to_string())?;
    
    Ok(())
}

fn get_maven_path(name: &str) -> PathBuf {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return PathBuf::from(name);
    }
    
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    
    let filename = if parts.len() >= 4 {
        format!("{}-{}-{}.jar", artifact, version, parts[3])
    } else {
        format!("{}-{}.jar", artifact, version)
    };
    
    PathBuf::from(group).join(artifact).join(version).join(filename)
}
