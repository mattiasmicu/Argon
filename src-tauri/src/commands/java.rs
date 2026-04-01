use tauri::{command, AppHandle, Emitter, Manager};
use serde::{Serialize};
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::Write;
use futures_util::StreamExt;
use tar::Archive;
use flate2::read::GzDecoder;
use zip::ZipArchive;

#[derive(Debug, Serialize)]
struct PlatformInfo {
    os: String,
    arch: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct LaunchLog {
    pub line: String,
    pub level: String,
}

fn emit_log(app: &AppHandle, level: &str, message: String) {
    let _ = app.emit("launch-log", LaunchLog {
        line: message,
        level: level.to_string(),
    });
}

#[command]
pub async fn get_platform_info() -> Result<PlatformInfo, String> {
    let os = if cfg!(target_os = "windows") { "windows".to_string() }
        else if cfg!(target_os = "macos") { "macos".to_string() }
        else if cfg!(target_os = "linux") { "linux".to_string() }
        else { "unknown".to_string() };
    
    let arch = if cfg!(target_arch = "x86_64") { "x86_64".to_string() }
        else if cfg!(target_arch = "aarch64") { "aarch64".to_string() }
        else { "unknown".to_string() };
    
    Ok(PlatformInfo { os, arch })
}

#[command]
pub async fn get_os() -> Result<String, String> {
    Ok(if cfg!(target_os = "windows") { "windows".to_string() }
        else if cfg!(target_os = "macos") { "macos".to_string() }
        else if cfg!(target_os = "linux") { "linux".to_string() }
        else { "unknown".to_string() })
}

#[command]
pub async fn get_arch() -> Result<String, String> {
    Ok(if cfg!(target_arch = "x86_64") { "x86_64".to_string() }
        else if cfg!(target_arch = "aarch64") { "aarch64".to_string() }
        else { "unknown".to_string() })
}

#[command]
pub async fn detect_java_version(app: AppHandle, required_version: String) -> Result<Option<String>, String> {
    emit_log(&app, "debug", format!("detect_java_version called with required_version: {}", required_version));
    
    let required: i32 = required_version.parse().map_err(|e| format!("Invalid version: {}", e))?;
    
    // Get instance-specific Java directory
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let java_dir = app_data.join("java").join(format!("jre-{}", required));
    let os = get_os_internal();
    
    let java_bin_path = java_dir.join("bin").join(if os == "windows" { "java.exe" } else { "java" });
    
    emit_log(&app, "info", format!("Checking for Java {} at: {}", required, java_bin_path.to_string_lossy()));
    
    if java_bin_path.exists() {
        emit_log(&app, "info", format!("Found Java {} at: {}", required, java_bin_path.to_string_lossy()));
        return Ok(Some(java_bin_path.to_string_lossy().to_string()));
    }
    
    emit_log(&app, "info", format!("Java {} not found at: {}", required, java_dir.to_string_lossy()));
    Ok(None)
}

fn get_os_internal() -> String {
    if cfg!(target_os = "windows") { "windows".to_string() }
    else if cfg!(target_os = "macos") { "macos".to_string() }
    else if cfg!(target_os = "linux") { "linux".to_string() }
    else { "unknown".to_string() }
}

fn get_arch_internal() -> String {
    if cfg!(target_arch = "x86_64") { "x86_64".to_string() }
    else if cfg!(target_arch = "aarch64") { "aarch64".to_string() }
    else { "unknown".to_string() }
}

#[command]
pub async fn download_java(app: AppHandle, os: String, arch: String, version: i32) -> Result<String, String> {
    emit_log(&app, "info", format!("download_java called with OS: {}, arch: {}, version: {}", os, arch, version));
    
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let java_dir = app_data.join("java").join(format!("jre-{}", version));
    let java_bin_path = java_dir.join("bin").join(if os == "windows" { "java.exe" } else { "java" });
    
    if java_bin_path.exists() {
        emit_log(&app, "info", format!("Java {} already exists at: {}", version, java_bin_path.to_string_lossy()));
        return Ok(java_bin_path.to_string_lossy().to_string());
    }
    
    emit_log(&app, "info", format!("Java {} not found, downloading from Adoptium...", version));
    
    std::fs::create_dir_all(&java_dir).map_err(|e| format!("Failed to create Java directory: {}", e))?;
    
    let download_url = format!(
        "https://api.adoptium.net/v3/binary/latest/{}/ga/{}/{}/jre/hotspot/normal/eclipse",
        version,
        map_os(&os),
        map_arch(&arch)
    );
    
    emit_log(&app, "info", format!("Downloading from: {}", download_url));
    
    let response = reqwest::get(&download_url).await.map_err(|e| format!("Failed to download Java: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Adoptium API returned error: {}", response.status()));
    }
    
    let temp_dir = std::env::temp_dir().join(format!("argon-java-download-{}", version));
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;
    
    let archive_ext = if os == "windows" { "zip" } else { "tar.gz" };
    let archive_path = temp_dir.join(format!("java.{}", archive_ext));
    
    emit_log(&app, "info", format!("Downloading Java {} archive...", version));
    
    let mut stream = response.bytes_stream();
    let mut file = File::create(&archive_path).map_err(|e| format!("Failed to create archive file: {}", e))?;
    
    let mut total_bytes: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("Download error: {}", e))?;
        total_bytes += bytes.len() as u64;
        file.write_all(&bytes).map_err(|e| format!("Write error: {}", e))?;
    }
    drop(file);
    
    emit_log(&app, "info", format!("Downloaded {} bytes, extracting...", total_bytes));
    
    let extract_dir = temp_dir.join("extracted");
    std::fs::create_dir_all(&extract_dir).map_err(|e| format!("Failed to create extract dir: {}", e))?;
    
    if os == "windows" {
        extract_zip(&archive_path, &extract_dir, &app)?;
    } else {
        extract_tar_gz(&archive_path, &extract_dir, &app)?;
    }
    
    emit_log(&app, "info", "Extraction complete, finding Java home...".to_string());
    
    let extracted_java_dir = find_java_home(&extract_dir, &os, &app)?;
    emit_log(&app, "info", format!("Found Java home at: {}", extracted_java_dir.to_string_lossy()));
    copy_dir_recursive(&extracted_java_dir, &java_dir).map_err(|e| format!("Failed to copy Java: {}", e))?;
    
    std::fs::remove_dir_all(&temp_dir).map_err(|e| format!("Failed to cleanup: {}", e))?;
    
    if !java_bin_path.exists() {
        return Err(format!("Java installation failed - binary not found at: {}", java_bin_path.to_string_lossy()));
    }
    
    emit_log(&app, "info", format!("Java {} installed successfully at: {}", version, java_bin_path.to_string_lossy()));
    Ok(java_bin_path.to_string_lossy().to_string())
}

fn map_os(os: &str) -> &'static str {
    match os {
        "windows" => "windows",
        "macos" => "mac",
        "linux" => "linux",
        _ => "linux",
    }
}

fn map_arch(arch: &str) -> &'static str {
    match arch {
        "x86_64" => "x64",
        "aarch64" => "aarch64",
        _ => "x64",
    }
}

fn extract_tar_gz(archive_path: &Path, extract_dir: &Path, _app: &AppHandle) -> Result<(), String> {
    let file = File::open(archive_path).map_err(|e| format!("Failed to open archive: {}", e))?;
    let gz = GzDecoder::new(file);
    let mut archive = Archive::new(gz);
    archive.unpack(extract_dir).map_err(|e| format!("Failed to extract tar.gz: {}", e))?;
    Ok(())
}

fn extract_zip(archive_path: &Path, extract_dir: &Path, _app: &AppHandle) -> Result<(), String> {
    let file = File::open(archive_path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Failed to read zip entry: {}", e))?;
        let out_path = extract_dir.join(file.name());
        
        if file.name().ends_with('/') {
            std::fs::create_dir_all(&out_path).map_err(|e| format!("Failed to create dir: {}", e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            let mut out_file = File::create(&out_path).map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut out_file).map_err(|e| format!("Failed to write file: {}", e))?;
        }
    }
    Ok(())
}

fn find_java_home(extract_dir: &Path, os: &str, app: &AppHandle) -> Result<PathBuf, String> {
    emit_log(app, "debug", format!("Searching for Java home in: {}", extract_dir.to_string_lossy()));
    
    // Recursively search for bin/java or bin/java.exe
    fn search_dir(dir: &Path, os: &str, depth: usize, app: &AppHandle) -> Option<PathBuf> {
        if depth > 3 {
            return None;
        }
        
        // Check if this dir has bin/java
        let java_bin = dir.join("bin").join(if os == "windows" { "java.exe" } else { "java" });
        if java_bin.exists() {
            emit_log(app, "debug", format!("Found Java at: {}", java_bin.to_string_lossy()));
            return Some(dir.to_path_buf());
        }
        
        // Check macOS Contents/Home structure
        let macos_home = dir.join("Contents").join("Home");
        if macos_home.exists() {
            let result = search_dir(&macos_home, os, depth + 1, app);
            if result.is_some() {
                return result;
            }
        }
        
        // Recurse into subdirectories
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    emit_log(app, "debug", format!("  Searching in: {}", path.to_string_lossy()));
                    if let Some(result) = search_dir(&path, os, depth + 1, app) {
                        return Some(result);
                    }
                }
            }
        }
        None
    }
    
    if let Some(java_home) = search_dir(extract_dir, os, 0, app) {
        return Ok(java_home);
    }
    
    emit_log(app, "warn", "Could not find bin/java, returning extract root".to_string());
    Ok(extract_dir.to_path_buf())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dest_path = dst.join(entry.file_name());
        
        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            std::fs::copy(&path, &dest_path)?;
        }
    }
    Ok(())
}
