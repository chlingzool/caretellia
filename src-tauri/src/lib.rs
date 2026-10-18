// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;

use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Emitter, Manager};

const CLC_OPEN_EVENT: &str = "caretellia-open-clc";
static NEXT_CLC_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ClcOpenRequest {
    id: u64,
    path: String,
}

impl ClcOpenRequest {
    fn from_path(path: PathBuf) -> Option<Self> {
        let is_clc = path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("clc"));
        is_clc.then(|| Self {
            id: NEXT_CLC_REQUEST_ID.fetch_add(1, Ordering::Relaxed),
            path: path.to_string_lossy().into_owned(),
        })
    }
}

struct PendingClcFiles(std::sync::Mutex<VecDeque<ClcOpenRequest>>);

fn initial_clc_files() -> VecDeque<ClcOpenRequest> {
    std::env::args_os()
        .skip(1)
        .filter_map(|argument| ClcOpenRequest::from_path(PathBuf::from(argument)))
        .collect()
}

fn enqueue_clc_file(app: &tauri::AppHandle, request: ClcOpenRequest) {
    match app.state::<PendingClcFiles>().0.lock() {
        Ok(mut pending) => pending.push_back(request.clone()),
        Err(error) => eprintln!("Unable to queue opened CLC file: {error}"),
    }
    if let Err(error) = app.emit(CLC_OPEN_EVENT, request) {
        eprintln!("Unable to notify the app about an opened CLC file: {error}");
    }
}

#[tauri::command]
fn take_initial_clc_files(
    state: tauri::State<'_, PendingClcFiles>,
) -> Result<Vec<ClcOpenRequest>, String> {
    let mut pending = state.0.lock().map_err(|error| error.to_string())?;
    Ok(pending.drain(..).collect())
}

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
    let builder = tauri::Builder::default()
        .manage(PendingClcFiles(std::sync::Mutex::new(initial_clc_files())));

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        if let Some(request) = argv
            .into_iter()
            .skip(1)
            .find_map(|argument| ClcOpenRequest::from_path(PathBuf::from(argument)))
        {
            enqueue_clc_file(app, request);
        }
    }));

    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let app = builder
        .invoke_handler(tauri::generate_handler![
            take_initial_clc_files,
            save_postcard,
            save_postcard_binary,
            save_postcard_binary_to_path,
            save_postcard_html_to_path,
            read_clc_file,
            local_clc_file_exists,
            commands::fonts::get_system_fonts,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::Opened { urls } = event {
            for request in urls
                .into_iter()
                .filter_map(|url| url.to_file_path().ok())
                .filter_map(ClcOpenRequest::from_path)
            {
                enqueue_clc_file(app_handle, request);
            }
        }

        #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
        let _ = (app_handle, event);
    });
}
