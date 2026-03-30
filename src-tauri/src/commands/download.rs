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
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionInfo {
    pub id: String,
    pub downloads: Downloads,
    pub libraries: Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    #[serde(rename = "javaVersion")]
    pub java_version: Option<JavaVersion>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JavaVersion {
    pub component: String,
    #[serde(rename = "majorVersion")]
    pub major_version: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Downloads {
    pub client: DownloadFile,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadFile {
    pub sha1: String,
    pub size: u64,
    pub url: String,
    pub path: Option<String>, // For library classifiers
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
    #[serde(rename = "totalSize")]
    pub total_size: u64,
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
    pub stage: String,
    pub current: u64,
    pub total: u64,
    pub percent: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct DownloadLog {
    pub message: String,
    pub level: String,
}

fn emit_log(app: &AppHandle, level: &str, msg: impl Into<String>) {
    let _ = app.emit("download-log", DownloadLog {
        message: msg.into(),
        level: level.to_string(),
    });
}

#[command]
pub async fn get_java_version_requirement(version_id: String) -> Result<i32, String> {
    let manifest = fetch_version_manifest().await?;
    let version = manifest.versions.iter().find(|v| v.id == version_id)
        .ok_or_else(|| format!("Version '{}' not found in manifest", version_id))?;

    let resp = reqwest::get(&version.url).await.map_err(|e: reqwest::Error| e.to_string())?;
    let version_json: serde_json::Value = resp.json().await.map_err(|e: reqwest::Error| e.to_string())?;
    
    // Try to get Java version from metadata, default to 17 if not specified
    if let Some(java_version) = version_json.get("javaVersion").and_then(|jv| jv.get("majorVersion")).and_then(|mv| mv.as_i64()) {
        return Ok(java_version as i32);
    }
    
    // Fallback: determine based on version ID
    if version_id.starts_with("1.") {
        let parts: Vec<&str> = version_id.split('.').collect();
        if parts.len() >= 2 {
            if let Ok(minor) = parts[1].parse::<i32>() {
                if minor <= 12 {
                    return Ok(8); // Very old versions
                } else if minor <= 16 {
                    return Ok(16); // 1.13-1.16
                } else if minor <= 17 {
                    return Ok(17); // 1.17
                } else if minor <= 18 {
                    return Ok(17); // 1.18
                } else if minor <= 20 {
                    return Ok(17); // 1.19-1.20
                } else {
                    return Ok(21); // 1.21+
                }
            }
        }
    }
    
    // For recent versions without explicit Java version, assume 21
    Ok(21)
}

#[command]
pub async fn fetch_version_manifest() -> Result<VersionManifest, String> {
    let url = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
    let resp = reqwest::get(url).await.map_err(|e: reqwest::Error| e.to_string())?;
    let manifest: VersionManifest = resp.json().await.map_err(|e: reqwest::Error| e.to_string())?;
    Ok(manifest)
}

#[command]
pub async fn download_version(app: AppHandle, version_id: String) -> Result<(), String> {
    emit_log(&app, "info", format!("Starting download for Minecraft {}", version_id));

    let manifest = fetch_version_manifest().await?;
    let version = manifest.versions.iter().find(|v| v.id == version_id)
        .ok_or_else(|| format!("Version '{}' not found in manifest", version_id))?;

    let app_data = app.path().app_data_dir().map_err(|e: tauri::Error| e.to_string())?;
    let version_dir = app_data.join("versions").join(&version_id);
    fs::create_dir_all(&version_dir).map_err(|e: std::io::Error| e.to_string())?;

    // ── Fetch & save version JSON ────────────────────────────────────────────
    // The launcher needs this file to know classpaths, main class, args, etc.
    let version_json_path = version_dir.join(format!("{}.json", version_id));
    let version_json_raw: String;

    if version_json_path.exists() {
        emit_log(&app, "info", "Version JSON already cached.");
        version_json_raw = fs::read_to_string(&version_json_path)
            .map_err(|e: std::io::Error| e.to_string())?;
    } else {
        emit_log(&app, "info", "Fetching version metadata...");
        let resp = reqwest::get(&version.url).await.map_err(|e: reqwest::Error| e.to_string())?;
        version_json_raw = resp.text().await.map_err(|e: reqwest::Error| e.to_string())?;
        fs::write(&version_json_path, &version_json_raw).map_err(|e: std::io::Error| e.to_string())?;
        emit_log(&app, "info", format!("Saved version JSON to {:?}", version_json_path));
    }

    let version_info: VersionInfo = serde_json::from_str(&version_json_raw)
        .map_err(|e: serde_json::Error| format!("Failed to parse version JSON: {}", e))?;

    // ── Stage 1: Client JAR ──────────────────────────────────────────────────
    emit_log(&app, "info", "Stage 1/3: Downloading client JAR...");
    let client_path = version_dir.join(format!("{}.jar", version_id));

    let _ = app.emit("download-progress", DownloadProgress {
        file: format!("{}.jar", version_id),
        stage: "client".into(),
        current: 0,
        total: 1,
        percent: 0.0,
    });

    download_file(&app, &version_info.downloads.client, &client_path, "client", 0, 1, true).await?;
    emit_log(&app, "info", "✓ Client JAR downloaded.");

    // ── Stage 2: Libraries ───────────────────────────────────────────────────
    let libs_dir = app_data.join("libraries");
    let mut libs_to_download: Vec<(String, DownloadFile, String)> = Vec::new(); // (name, download_info, path_str)
    
    for lib in &version_info.libraries {
        if !should_download_lib(lib) {
            continue;
        }
        
        // Main artifact
        if let Some(artifact) = &lib.downloads.artifact {
            let path_str = artifact.path.clone().unwrap_or_else(|| get_lib_path(&lib.name).to_string_lossy().to_string());
            libs_to_download.push((lib.name.clone(), artifact.clone(), path_str));
        }
        
        // Classifiers (natives) - download the ones for current OS/arch
        if let Some(classifiers) = &lib.downloads.classifiers {
            let os_name = get_os_name();
            for (classifier_name, classifier_info) in classifiers.as_object().unwrap_or(&serde_json::Map::new()) {
                // Only download natives for current OS
                let should_download = match os_name {
                    "osx" => classifier_name.contains("macos") || classifier_name.contains("osx"),
                    "windows" => classifier_name.contains("windows"),
                    "linux" => classifier_name.contains("linux"),
                    _ => false,
                };
                
                // For macOS, prefer arm64 on aarch64, x86_64 on x86_64
                if should_download {
                    let is_arm64 = cfg!(target_arch = "aarch64");
                    let is_x64 = cfg!(target_arch = "x86_64");
                    
                    let arch_matches = if is_arm64 {
                        classifier_name.contains("arm64") || (!classifier_name.contains("x86") && !classifier_name.contains("x64"))
                    } else if is_x64 {
                        classifier_name.contains("x86_64") || classifier_name.contains("x64") || (!classifier_name.contains("arm64"))
                    } else {
                        true // Unknown arch, download it
                    };
                    
                    if arch_matches {
                        let classifier_artifact: DownloadFile = serde_json::from_value(classifier_info.clone())
                            .map_err(|e| format!("Failed to parse classifier: {}", e))?;
                        let full_name = format!("{}:{}", lib.name, classifier_name);
                        // Use the path from the JSON if available
                        let full_name_clone = full_name.clone();
                        libs_to_download.push((full_name, classifier_artifact.clone(), 
                            classifier_artifact.path.clone().unwrap_or_else(|| get_lib_path(&full_name_clone).to_string_lossy().to_string())));
                    }
                }
            }
        }
    }

    let total_libs = libs_to_download.len() as u64;
    emit_log(&app, "info", format!("Stage 2/3: Downloading {} libraries (including natives)...", total_libs));

    // Download libraries concurrently (up to 10 at a time)
    use tokio::sync::Semaphore;
    let semaphore = std::sync::Arc::new(Semaphore::new(10));
    let libs_dir = app_data.join("libraries");
    let mut handles: Vec<tokio::task::JoinHandle<(String, Result<bool, String>)>> = Vec::new();
    for (i, (lib_name, artifact, path_str)) in libs_to_download.into_iter().enumerate() {
        let permit = semaphore.clone().acquire_owned().await.map_err(|e| e.to_string())?;
        let app_clone = app.clone();
        let libs_dir_clone = libs_dir.clone();
        let handle = tokio::spawn(async move {
            let _permit = permit;
            let lib_path = libs_dir_clone.join(&path_str);
            let result = download_file(&app_clone, &artifact, &lib_path, "libraries", i as u64, total_libs, false).await;
            (lib_name, result)
        });
        handles.push(handle);
    }
    
    let mut downloaded_count = 0;
    let mut error_count = 0;
    for (i, handle) in handles.into_iter().enumerate() {
        match handle.await {
            Ok((lib_name, Ok(true))) => {
                downloaded_count += 1;
                emit_log(&app, "info", format!("[{}/{}] {}", i + 1, total_libs, lib_name));
            }
            Ok((lib_name, Ok(false))) => {
                // Already existed, don't log
            }
            Ok((lib_name, Err(e))) => {
                error_count += 1;
                emit_log(&app, "error", format!("Failed to download {}: {}", lib_name, e));
            }
            Err(e) => {
                error_count += 1;
                emit_log(&app, "error", format!("Task panicked: {}", e));
            }
        }
    }
    
    emit_log(&app, "info", format!("✓ Libraries downloaded ({} new, {} errors).", downloaded_count, error_count));

    // ── Stage 3: Assets ──────────────────────────────────────────────────────
    emit_log(&app, "info", format!("Fetching asset index ({})...", version_info.asset_index.id));

    // Save asset index JSON too
    let asset_index_dir = app_data.join("assets").join("indexes");
    fs::create_dir_all(&asset_index_dir).map_err(|e: std::io::Error| e.to_string())?;
    let asset_index_path = asset_index_dir.join(format!("{}.json", version_info.asset_index.id));

    let asset_json_raw: String;
    if asset_index_path.exists() {
        emit_log(&app, "info", "Asset index already cached.");
        asset_json_raw = fs::read_to_string(&asset_index_path)
            .map_err(|e: std::io::Error| e.to_string())?;
    } else {
        let resp = reqwest::get(&version_info.asset_index.url)
            .await.map_err(|e: reqwest::Error| e.to_string())?;
        asset_json_raw = resp.text().await.map_err(|e: reqwest::Error| e.to_string())?;
        fs::write(&asset_index_path, &asset_json_raw).map_err(|e: std::io::Error| e.to_string())?;
    }

    let asset_objects: AssetObjects = serde_json::from_str(&asset_json_raw)
        .map_err(|e: serde_json::Error| e.to_string())?;

    let total_assets = asset_objects.objects.len() as u64;
    emit_log(&app, "info", format!("Stage 3/3: Downloading {} assets concurrently...", total_assets));

    let assets_dir = app_data.join("assets").join("objects");
    let mut _downloaded_count: u64 = 0;

    // Download assets concurrently (up to 50 at a time)
    let semaphore = std::sync::Arc::new(Semaphore::new(50));
    let mut handles = Vec::new();
    
    for (asset_num, (_name, asset)) in asset_objects.objects.into_iter().enumerate() {
        let permit = semaphore.clone().acquire_owned().await.map_err(|e| e.to_string())?;
        let app_clone = app.clone();
        let hash = asset.hash;
        let size = asset.size;
        let subfolder = hash[0..2].to_string();
        let asset_path = assets_dir.join(&subfolder).join(&hash);
        let url = format!("https://resources.download.minecraft.net/{}/{}", subfolder, hash);
        
        let handle = tokio::spawn(async move {
            let _permit = permit;
            let download_info = DownloadFile {
                sha1: hash,
                size,
                url,
                path: None,
            };
            // Only emit progress every 100 assets
            let should_emit = (asset_num % 100 == 0) || (asset_num as u64 == total_assets - 1);
            download_file(&app_clone, &download_info, &asset_path, "assets", asset_num as u64, total_assets, should_emit).await
        });
        handles.push(handle);
    }
    
    let mut downloaded_count = 0;
    for handle in handles {
        if let Ok(Ok(true)) = handle.await {
            downloaded_count += 1;
        }
    }
    
    emit_log(&app, "info", format!("✓ All assets downloaded ({} new).", downloaded_count));
    emit_log(&app, "info", "✓ Download complete! Ready to launch.");

    let _ = app.emit("download-progress", DownloadProgress {
        file: "Done".into(),
        stage: "done".into(),
        current: total_assets,
        total: total_assets,
        percent: 100.0,
    });

    Ok(())
}

async fn download_file(
    app: &AppHandle,
    info: &DownloadFile,
    path: &Path,
    stage: &str,
    current: u64,
    total: u64,
    emit_progress: bool,
) -> Result<bool, String> {
    if path.exists() {
        if let Ok(bytes) = fs::read(path) {
            let mut hasher = Sha1::new();
            hasher.update(&bytes);
            let hash = hex::encode(hasher.finalize());
            if hash == info.sha1 {
                // File exists and is valid, skip download - only emit progress occasionally
                if emit_progress {
                    let _ = app.emit("download-progress", DownloadProgress {
                        file: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                        stage: stage.to_string(),
                        current,
                        total,
                        percent: if total > 0 { (current as f64 / total as f64) * 100.0 } else { 100.0 },
                    });
                }
                return Ok(false); // false = skipped
            }
        }
    }

    // File doesn't exist or is invalid, download it
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e: std::io::Error| e.to_string())?;
    }

    let response = reqwest::get(&info.url).await.map_err(|e: reqwest::Error| e.to_string())?;
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::with_capacity(info.size as usize);

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e: reqwest::Error| e.to_string())?;
        bytes.extend_from_slice(&chunk);
    }

    fs::write(path, &bytes).map_err(|e: std::io::Error| e.to_string())?;

    if emit_progress {
        let _ = app.emit("download-progress", DownloadProgress {
            file: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
            stage: stage.to_string(),
            current: current + 1,
            total,
            percent: if total > 0 { ((current + 1) as f64 / total as f64) * 100.0 } else { 100.0 },
        });
    }

    Ok(true) // true = downloaded
}

fn should_download_lib(lib: &Library) -> bool {
    if let Some(rules) = &lib.rules {
        let mut allowed = false;
        for rule in rules {
            if rule.action == "allow" {
                if let Some(os) = &rule.os {
                    if os.name == get_os_name() { allowed = true; }
                } else {
                    allowed = true;
                }
            } else if rule.action == "disallow" {
                if let Some(os) = &rule.os {
                    if os.name == get_os_name() { allowed = false; }
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