use tauri::{command, AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::fs;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub version: String,
    pub loader: String,
    pub last_played: Option<i64>,
    pub icon: Option<String>,
}

#[derive(Deserialize)]
pub struct InstancePatch {
    pub name: Option<String>,
    pub last_played: Option<i64>,
    pub icon: Option<String>,
}

#[command]
pub async fn list_instances(app: AppHandle) -> Result<Vec<Instance>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instances_dir = app_data.join("instances");

    if !instances_dir.exists() {
        return Ok(vec![]);
    }

    let mut instances = Vec::new();
    if let Ok(entries) = fs::read_dir(instances_dir) {
        for entry in entries.flatten() {
            let json_path = entry.path().join("instance.json");
            if json_path.exists() {
                if let Ok(content) = fs::read_to_string(json_path) {
                    if let Ok(instance) = serde_json::from_str::<Instance>(&content) {
                        instances.push(instance);
                    }
                }
            }
        }
    }

    Ok(instances)
}

#[command]
pub async fn create_instance(
    app: AppHandle,
    name: String,
    version: String,
    loader: String,
) -> Result<Instance, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let id = sanitize_folder_name(&name);
    let instance_dir = app_data.join("instances").join(&id);

    let final_id = if instance_dir.exists() {
        let mut counter = 1;
        loop {
            let new_id = format!("{}-{}", id, counter);
            if !app_data.join("instances").join(&new_id).exists() {
                break new_id;
            }
            counter += 1;
        }
    } else {
        id
    };

    let instance_dir = app_data.join("instances").join(&final_id);
    fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;

    for dir in &["mods", "config", "saves", "resourcepacks", "screenshots"] {
        fs::create_dir_all(instance_dir.join(dir)).ok();
    }

    let instance = Instance {
        id: final_id.clone(),
        name,
        version,
        loader,
        last_played: None,
        icon: None,
    };

    let json_path = instance_dir.join("instance.json");
    let content = serde_json::to_string_pretty(&instance).map_err(|e| e.to_string())?;
    fs::write(json_path, content).map_err(|e| e.to_string())?;

    Ok(instance)
}

fn sanitize_folder_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => c,
            _ => '-',
        })
        .collect::<String>()
        .to_lowercase()
}

#[command]
pub async fn delete_instance(app: AppHandle, id: String) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(id);
    if instance_dir.exists() {
        fs::remove_dir_all(instance_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn duplicate_instance(app: AppHandle, id: String) -> Result<Instance, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let source_dir = app_data.join("instances").join(&id);
    let new_id = Uuid::new_v4().to_string();
    let dest_dir = app_data.join("instances").join(&new_id);

    copy_dir::copy_dir(&source_dir, &dest_dir).map_err(|e| e.to_string())?;

    let json_path = dest_dir.join("instance.json");
    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let mut instance: Instance = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    instance.id = new_id;
    instance.name = format!("{} (Copy)", instance.name);

    let content = serde_json::to_string_pretty(&instance).map_err(|e| e.to_string())?;
    fs::write(json_path, content).map_err(|e| e.to_string())?;

    Ok(instance)
}

#[command]
pub async fn update_instance(
    app: AppHandle,
    id: String,
    patch: InstancePatch,
) -> Result<Instance, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&id);
    let json_path = instance_dir.join("instance.json");

    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let mut instance: Instance = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(name) = patch.name {
        instance.name = name;
    }
    if let Some(lp) = patch.last_played {
        instance.last_played = Some(lp);
    }
    if let Some(icon) = patch.icon {
        instance.icon = Some(icon);
    }

    let content = serde_json::to_string_pretty(&instance).map_err(|e| e.to_string())?;
    fs::write(json_path, content).map_err(|e| e.to_string())?;

    Ok(instance)
}

#[command]
pub async fn upload_instance_icon(
    app: AppHandle,
    id: String,
    icon_data: Vec<u8>,
    extension: String,
) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let instance_dir = app_data.join("instances").join(&id);
    
    // Create icons directory if it doesn't exist
    let icons_dir = instance_dir.join("icons");
    fs::create_dir_all(&icons_dir).map_err(|e| e.to_string())?;
    
    // Generate unique filename
    let icon_filename = format!("icon.{}", extension);
    let icon_path = icons_dir.join(&icon_filename);
    
    // Write the icon data to file
    fs::write(&icon_path, &icon_data).map_err(|e| e.to_string())?;
    
    // Return the full absolute path so convertFileSrc can convert it to asset:// URL
    let full_path = icon_path.to_string_lossy().to_string();
    Ok(full_path)
}