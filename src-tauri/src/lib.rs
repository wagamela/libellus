use std::fs;
use std::io::Write;
use std::path::PathBuf;

use tauri::Manager;

/// The whole workspace lives in one JSON file inside the OS app-data
/// directory. SQLite replaces this later; the command surface stays the same.
fn store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data directory: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {dir:?}: {e}"))?;
    Ok(dir.join("store.json"))
}

#[tauri::command]
fn load_store(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = store_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(format!("cannot read store: {err}")),
    }
}

#[tauri::command]
fn save_store(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let path = store_path(&app)?;
    let temp = path.with_extension("json.tmp");

    // Write to a sibling file and rename, so an interrupted save can never
    // truncate an existing store.
    let mut file = fs::File::create(&temp).map_err(|e| format!("cannot open store: {e}"))?;
    file.write_all(contents.as_bytes())
        .map_err(|e| format!("cannot write store: {e}"))?;
    file.sync_all().map_err(|e| format!("cannot flush store: {e}"))?;
    drop(file);

    fs::rename(&temp, &path).map_err(|e| format!("cannot commit store: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_store, save_store])
        .run(tauri::generate_context!())
        .expect("error while running libellus");
}
