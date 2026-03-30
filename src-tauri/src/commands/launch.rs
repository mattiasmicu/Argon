use tauri::{command, AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::fs;

#[derive(Debug, Serialize, Clone)]
pub struct LaunchLog {
    pub line: String,
    pub level: String,
}

#[command]
pub async fn launch_instance(
    app: AppHandle,
    id: String,
    java_path: String,
    ram_mb: u32,
    username: String,
    uuid: String,
    access_token: String,
) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&id);
    
    // Read instance.json to get version
    let instance_json = fs::read_to_string(instance_dir.join("instance.json")).map_err(|e| e.to_string())?;
    let instance: serde_json::Value = serde_json::from_str(&instance_json).map_err(|e| e.to_string())?;
    let version_id = instance["version"].as_str().ok_or("No version in instance.json")?;

    // Read version info to get libraries
    let version_json_path = app_data.join("versions").join(version_id).join(format!("{}.json", version_id));
    if !version_json_path.exists() {
        return Err("Version JSON missing. Please download version first.".to_string());
    }
    let version_json = fs::read_to_string(&version_json_path).map_err(|e| e.to_string())?;
    let version_info: serde_json::Value = serde_json::from_str(&version_json).map_err(|e| e.to_string())?;

    // Build Classpath
    let mut classpath = Vec::new();
    let libs_dir = app_data.join("libraries");
    if let Some(libraries) = version_info["libraries"].as_array() {
        for lib in libraries {
            if let Some(name) = lib["name"].as_str() {
                let lib_path = libs_dir.join(get_lib_path(name));
                if lib_path.exists() {
                    classpath.push(lib_path.to_string_lossy().to_string());
                }
            }
        }
    }
    let client_jar = app_data.join("versions").join(version_id).join(format!("{}.jar", version_id));
    classpath.push(client_jar.to_string_lossy().to_string());

    let classpath_sep = if cfg!(target_os = "windows") { ";" } else { ":" };
    let full_classpath = classpath.join(classpath_sep);

    // Build Arguments
    let mut args = Vec::new();
    args.push(format!("-Xmx{}m", ram_mb));
    args.push("-Xms512m".to_string());
    args.push("-Djava.library.path=natives".to_string());
    args.push("-Dlog4j2.formatMsgNoLookups=true".to_string());
    args.push("-cp".to_string());
    args.push(full_classpath);
    args.push(version_info["mainClass"].as_str().unwrap_or("net.minecraft.client.main.Main").to_string());

    // Game Args
    args.push("--username".to_string());
    args.push(username);
    args.push("--uuid".to_string());
    args.push(uuid);
    args.push("--accessToken".to_string());
    args.push(access_token);
    args.push("--gameDir".to_string());
    args.push(instance_dir.to_string_lossy().to_string());
    args.push("--assetsDir".to_string());
    args.push(app_data.join("assets").to_string_lossy().to_string());
    args.push("--assetIndex".to_string());
    args.push(version_info["assetIndex"]["id"].as_str().unwrap_or("1.20").to_string());
    args.push("--version".to_string());
    args.push(version_id.to_string());
    args.push("--userType".to_string());
    args.push("mojang".to_string());

    let mut child = Command::new(java_path)
        .args(args)
        .current_dir(&instance_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_clone.emit("launch-log", LaunchLog {
                line,
                level: "info".to_string(),
            });
        }
    });

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let _ = app_clone.emit("launch-log", LaunchLog {
                line,
                level: "error".to_string(),
            });
        }
    });

    std::thread::spawn(move || {
        let status = child.wait().unwrap();
        let _ = app.emit("launch-exit", status.code().unwrap_or(0));
    });

    Ok(())
}

#[command]
pub async fn kill_instance(_id: String) -> Result<(), String> {
    Ok(())
}

fn get_lib_path(name: &str) -> PathBuf {
    let parts: Vec<&str> = name.split(':').collect();
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    PathBuf::from(group).join(artifact).join(version).join(format!("{}-{}.jar", artifact, version))
}
