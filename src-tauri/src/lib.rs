pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::auth::start_device_auth,
            commands::auth::poll_device_auth,
            commands::auth::open_link_window,
            commands::auth::close_link_window,
            commands::auth::refresh_token,
            commands::auth::logout,
            commands::java::detect_java,
            commands::java::download_java,
            commands::instances::list_instances,
            commands::instances::create_instance,
            commands::instances::delete_instance,
            commands::instances::duplicate_instance,
            commands::instances::update_instance,
            commands::download::fetch_version_manifest,
            commands::download::download_version,
            commands::launch::launch_instance,
            commands::launch::kill_instance,
            commands::settings::get_settings,
            commands::settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}