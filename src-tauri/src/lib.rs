// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;

#[tauri::command]
fn save_postcard(
    file_name: String,
    content: String,
    export_directory: Option<String>,
) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let dir = export_directory
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .map(Path::new)
        .unwrap_or_else(|| Path::new("./postcards"));
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }

    let file_path = dir.join(&file_name);
    fs::write(&file_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_postcard,
            commands::fonts::get_system_fonts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
