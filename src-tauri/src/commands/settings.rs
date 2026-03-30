use tauri::{command, AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::fs;
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub java_path: Option<String>,
    pub ram_mb: u32,
    pub theme: String,
    pub last_instance_id: Option<String>,
}

#[command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_path = app_data.join("config.json");
    
    if config_path.exists() {
        let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        let settings: Settings = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(settings);
    }

    Ok(Settings {
        java_path: None,
        ram_mb: 4096,
        theme: "dark".to_string(),
        last_instance_id: None,
    })
}

#[command]
pub async fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let config_path = app_data.join("config.json");
    
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;

    Ok(())
}
