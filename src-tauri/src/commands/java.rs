use tauri::{command, AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::fs;
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JavaProgress {
    pub stage: String,
    pub percent: f64,
}

#[command]
pub async fn detect_java() -> Result<Option<String>, String> {
    let output = Command::new("java")
        .arg("-version")
        .output();

    match output {
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            if stderr.contains("21.") {
                return Ok(Some("java".to_string()));
            }
        }
        _ => {}
    }
    
    Ok(None)
}

#[command]
pub async fn download_java(app: AppHandle, os: String, arch: String) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let java_dir = app_data.join("java").join("jre-21");
    
    if java_dir.exists() {
        return Ok(java_dir.to_string_lossy().to_string());
    }

    fs::create_dir_all(&java_dir).map_err(|e| e.to_string())?;

    let url = match (os.as_str(), arch.as_str()) {
        ("windows", "x64") => "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_windows_hotspot_21.0.2_13.zip",
        ("macos", "x64") => "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_mac_hotspot_21.0.2_13.tar.gz",
        ("macos", "aarch64") => "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_aarch64_mac_hotspot_21.0.2_13.tar.gz",
        ("linux", "x64") => "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_linux_hotspot_21.0.2_13.tar.gz",
        _ => return Err("Unsupported OS/Arch combination".to_string()),
    };

    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        bytes.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;
        
        let percent = (downloaded as f64 / total_size as f64) * 100.0;
        let _ = app.emit("java-progress", JavaProgress {
            stage: "Downloading".to_string(),
            percent,
        });
    }

    let archive_path = app_data.join(if os == "windows" { "java.zip" } else { "java.tar.gz" });
    fs::write(&archive_path, bytes).map_err(|e| e.to_string())?;

    let _ = app.emit("java-progress", JavaProgress {
        stage: "Extracting".to_string(),
        percent: 100.0,
    });

    if os == "windows" {
        extract_zip(&archive_path, &java_dir).map_err(|e| e.to_string())?;
    } else {
        extract_targz(&archive_path, &java_dir).map_err(|e| e.to_string())?;
    }

    fs::remove_file(archive_path).ok();
    
    let mut final_path = java_dir;
    if let Ok(entries) = fs::read_dir(&final_path) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                final_path = entry.path();
                break;
            }
        }
    }

    Ok(final_path.join("bin").join(if os == "windows" { "java.exe" } else { "java" }).to_string_lossy().to_string())
}

fn extract_zip(path: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    archive.extract(dest).map_err(|e| e.to_string())?;
    Ok(())
}

fn extract_targz(path: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let tar = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(tar);
    archive.unpack(dest).map_err(|e| e.to_string())?;
    Ok(())
}
