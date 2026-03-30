use tauri::{command, AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use futures_util::StreamExt;
use sha1::{Sha1, Digest};
use hex;

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: Latest,
    pub versions: Vec<Version>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Latest {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Version {
    pub id: String,
    pub r#type: String,
    pub url: String,
    pub time: String,
    pub releaseTime: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionInfo {
    pub id: String,
    pub downloads: Downloads,
    pub libraries: Vec<Library>,
    pub assetIndex: AssetIndex,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Downloads {
    pub client: DownloadFile,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadFile {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Library {
    pub downloads: LibDownloads,
    pub name: String,
    pub rules: Option<Vec<Rule>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibDownloads {
    pub artifact: Option<DownloadFile>,
    pub classifiers: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Rule {
    pub action: String,
    pub os: Option<OSRule>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OSRule {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
    pub totalSize: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetObjects {
    pub objects: std::collections::HashMap<String, Asset>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Asset {
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    pub file: String,
    pub current: u64,
    pub total: u64,
    pub percent: f64,
}

#[command]
pub async fn fetch_version_manifest() -> Result<VersionManifest, String> {
    let url = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
    let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let manifest: VersionManifest = resp.json().await.map_err(|e| e.to_string())?;
    Ok(manifest)
}

#[command]
pub async fn download_version(app: AppHandle, version_id: String) -> Result<(), String> {
    let manifest = fetch_version_manifest().await?;
    let version = manifest.versions.iter().find(|v| v.id == version_id)
        .ok_or_else(|| "Version not found".to_string())?;

    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let version_info_resp = reqwest::get(&version.url).await.map_err(|e| e.to_string())?;
    let version_info: VersionInfo = version_info_resp.json().await.map_err(|e| e.to_string())?;

    // 1. Download Client
    let client_path = app_data.join("versions").join(&version_id).join(format!("{}.jar", version_id));
    download_file(&app, &version_info.downloads.client, &client_path).await?;

    // 2. Download Libraries
    let libs_dir = app_data.join("libraries");
    for lib in version_info.libraries {
        if should_download_lib(&lib) {
            if let Some(artifact) = lib.downloads.artifact {
                let lib_path = libs_dir.join(get_lib_path(&lib.name));
                download_file(&app, &artifact, &lib_path).await?;
            }
        }
    }

    // 3. Download Assets
    let asset_index_resp = reqwest::get(&version_info.assetIndex.url).await.map_err(|e| e.to_string())?;
    let asset_objects: AssetObjects = asset_index_resp.json().await.map_err(|e| e.to_string())?;
    let assets_dir = app_data.join("assets").join("objects");

    for (_name, asset) in asset_objects.objects {
        let hash = &asset.hash;
        let subfolder = &hash[0..2];
        let asset_path = assets_dir.join(subfolder).join(hash);
        let download_info = DownloadFile {
            sha1: hash.clone(),
            size: asset.size,
            url: format!("https://resources.download.minecraft.net/{}/{}", subfolder, hash),
        };
        download_file(&app, &download_info, &asset_path).await?;
    }

    Ok(())
}

async fn download_file(app: &AppHandle, info: &DownloadFile, path: &Path) -> Result<(), String> {
    if path.exists() {
        if let Ok(bytes) = fs::read(path) {
            let mut hasher = Sha1::new();
            hasher.update(&bytes);
            let hash = hex::encode(hasher.finalize());
            if hash == info.sha1 {
                return Ok(());
            }
        }
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let response = reqwest::get(&info.url).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    let mut downloaded = 0;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        bytes.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;

        let _ = app.emit("download-progress", DownloadProgress {
            file: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
            current: downloaded,
            total: info.size,
            percent: (downloaded as f64 / info.size as f64) * 100.0,
        });
    }

    fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

fn should_download_lib(lib: &Library) -> bool {
    if let Some(rules) = &lib.rules {
        let mut allowed = false;
        for rule in rules {
            if rule.action == "allow" {
                if let Some(os) = &rule.os {
                    if os.name == get_os_name() {
                        allowed = true;
                    }
                } else {
                    allowed = true;
                }
            } else if rule.action == "disallow" {
                if let Some(os) = &rule.os {
                    if os.name == get_os_name() {
                        allowed = false;
                    }
                }
            }
        }
        allowed
    } else {
        true
    }
}

fn get_os_name() -> &'static str {
    #[cfg(target_os = "windows")] { "windows" }
    #[cfg(target_os = "macos")] { "osx" }
    #[cfg(target_os = "linux")] { "linux" }
}

fn get_lib_path(name: &str) -> PathBuf {
    let parts: Vec<&str> = name.split(':').collect();
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    PathBuf::from(group).join(artifact).join(version).join(format!("{}-{}.jar", artifact, version))
}
