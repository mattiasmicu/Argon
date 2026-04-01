use tauri::{command, AppHandle, Manager};
use serde::{Serialize, Deserialize};
use std::fs;
use crate::commands::instances::Instance;

#[derive(Debug, Serialize, Deserialize)]
pub struct InstanceSettings {
    pub name: String,
    pub version: String,
    pub loader: String,
    pub loader_version: Option<String>,
    pub icon: Option<String>,
    pub fullscreen: bool,
    pub width: u32,
    pub height: u32,
    pub memory_mb: u32,
    pub java_path: Option<String>,
    pub java_args: String,
    pub env_vars: String,
    pub pre_launch_cmd: Option<String>,
    pub wrapper_cmd: Option<String>,
    pub post_exit_cmd: Option<String>,
    pub use_custom_java: bool,
    pub use_custom_memory: bool,
    pub use_custom_java_args: bool,
    pub use_custom_env_vars: bool,
    pub use_window_settings: bool,
    pub use_custom_hooks: bool,
    pub group: Option<String>,
}

#[command]
pub async fn get_instance_settings(
    app: AppHandle,
    instance_id: String,
) -> Result<InstanceSettings, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&instance_id);
    let json_path = instance_dir.join("instance.json");

    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let instance: Instance = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Try to load settings from a separate settings file if it exists
    let settings_path = instance_dir.join("settings.json");
    let settings = if let Ok(settings_content) = fs::read_to_string(&settings_path) {
        serde_json::from_str(&settings_content).unwrap_or_else(|_| default_settings(&instance))
    } else {
        default_settings(&instance)
    };

    Ok(settings)
}

#[command]
pub async fn save_instance_settings(
    app: AppHandle,
    instance_id: String,
    settings: InstanceSettings,
) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&instance_id);
    
    // Save settings to settings.json
    let settings_path = instance_dir.join("settings.json");
    let settings_json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, settings_json).map_err(|e| e.to_string())?;

    // Also update the main instance.json with basic fields
    let json_path = instance_dir.join("instance.json");
    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let mut instance: Instance = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    instance.name = settings.name;
    instance.icon = settings.icon;

    let instance_json = serde_json::to_string_pretty(&instance).map_err(|e| e.to_string())?;
    fs::write(&json_path, instance_json).map_err(|e| e.to_string())?;

    Ok(())
}

fn default_settings(instance: &Instance) -> InstanceSettings {
    InstanceSettings {
        name: instance.name.clone(),
        version: instance.version.clone(),
        loader: instance.loader.clone(),
        loader_version: None,
        icon: instance.icon.clone(),
        fullscreen: false,
        width: 854,
        height: 480,
        memory_mb: 4096,
        java_path: None,
        java_args: String::new(),
        env_vars: String::new(),
        pre_launch_cmd: None,
        wrapper_cmd: None,
        post_exit_cmd: None,
        use_custom_java: false,
        use_custom_memory: false,
        use_custom_java_args: false,
        use_custom_env_vars: false,
        use_window_settings: false,
        use_custom_hooks: false,
        group: None,
    }
}
