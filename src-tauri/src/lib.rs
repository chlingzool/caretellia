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

#[tauri::command]
fn save_postcard_binary(
    file_name: String,
    content: Vec<u8>,
    export_directory: Option<String>,
) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    const MAX_FILE_SIZE: usize = 64 * 1024 * 1024;
    if content.is_empty() || content.len() > MAX_FILE_SIZE {
        return Err("CLC file size is invalid".into());
    }
    if file_name.len() > 100
        || !file_name.ends_with(".clc")
        || file_name.contains("..")
        || !file_name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_.".contains(character))
    {
        return Err("CLC file name is invalid".into());
    }

    let dir = export_directory
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .map(Path::new)
        .unwrap_or_else(|| Path::new("./postcards"));
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }

    fs::write(dir.join(file_name), content).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_postcard_binary_to_path(file_path: String, content: Vec<u8>) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    const MAX_FILE_SIZE: usize = 64 * 1024 * 1024;
    if content.is_empty() || content.len() > MAX_FILE_SIZE {
        return Err("CLC file size is invalid".into());
    }
    let path = Path::new(&file_path);
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("clc"))
    {
        return Err("CLC file extension is required".into());
    }
    if !path.is_absolute() || !path.file_name().is_some_and(|name| !name.is_empty()) {
        return Err("CLC file path is invalid".into());
    }
    fs::write(path, content).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_postcard_html_to_path(file_path: String, content: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    const MAX_FILE_SIZE: usize = 64 * 1024 * 1024;
    let path = Path::new(&file_path);
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("html"))
    {
        return Err("HTML file extension is required".into());
    }
    if !path.is_absolute() || !path.file_name().is_some_and(|name| !name.is_empty()) {
        return Err("HTML file path is invalid".into());
    }
    if content.is_empty() || content.len() > MAX_FILE_SIZE {
        return Err("HTML file size is invalid".into());
    }
    fs::write(path, content).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_clc_file(file_path: String) -> Result<Vec<u8>, String> {
    use std::fs;
    use std::path::Path;

    const MAX_FILE_SIZE: u64 = 64 * 1024 * 1024;
    let path = Path::new(&file_path);
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("clc"))
    {
        return Err("Selected file is not a CLC file".into());
    }
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() > MAX_FILE_SIZE {
        return Err("CLC file is not a regular file or exceeds the size limit".into());
    }
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    if bytes.len() as u64 > MAX_FILE_SIZE {
        return Err("CLC file exceeds the size limit".into());
    }
    Ok(bytes)
}

#[tauri::command]
fn local_clc_file_exists(file_path: String) -> Result<bool, String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(&file_path);
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("clc"))
    {
        return Ok(false);
    }
    match fs::metadata(path) {
        Ok(metadata) => Ok(metadata.is_file()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_postcard,
            save_postcard_binary,
            save_postcard_binary_to_path,
            save_postcard_html_to_path,
            read_clc_file,
            local_clc_file_exists,
            commands::fonts::get_system_fonts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
