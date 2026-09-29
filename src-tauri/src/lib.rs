use std::fs;
use std::io::Write;
use std::path::PathBuf;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

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

/// Pasted images are kept as real files beside the store rather than inside
/// it: a screenshot embedded in the JSON would be rewritten on every debounced
/// save. A document only ever holds the file name.
fn images_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data directory: {e}"))?
        .join("images");
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {dir:?}: {e}"))?;
    Ok(dir)
}

/// Names come from the frontend, so they are never trusted as paths: one flat
/// file name of known-safe characters, nothing that can climb out of the
/// directory.
fn image_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let safe = !name.is_empty()
        && name.len() <= 128
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        && !name.starts_with('.')
        && !name.contains("..");
    if !safe {
        return Err("invalid image name".into());
    }
    Ok(images_dir(app)?.join(name))
}

#[tauri::command]
fn save_image(app: tauri::AppHandle, name: String, data: String) -> Result<(), String> {
    let path = image_path(&app, &name)?;
    let bytes = BASE64
        .decode(data.as_bytes())
        .map_err(|_| "image is not valid base64".to_string())?;
    let temp = path.with_extension("tmp");
    fs::write(&temp, &bytes).map_err(|e| format!("cannot write image: {e}"))?;
    fs::rename(&temp, &path).map_err(|e| format!("cannot commit image: {e}"))
}

#[tauri::command]
fn load_image(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
    let path = image_path(&app, &name)?;
    match fs::read(&path) {
        Ok(bytes) => Ok(Some(BASE64.encode(bytes))),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(format!("cannot read image: {err}")),
    }
}

#[tauri::command]
fn delete_image(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let path = image_path(&app, &name)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(format!("cannot delete image: {err}")),
    }
}

/// "save as" hands a copy of a document to the user's own filesystem. Both the
/// picker and the write live here, so the frontend never needs a filesystem
/// scope and the capability set stays `core:default`. Returns the chosen path,
/// or `None` when the dialog was cancelled.
///
/// `#[tauri::command(async)]` matters: the blocking dialog must not run on the
/// main thread.
#[tauri::command(async)]
fn save_document_as(
    app: tauri::AppHandle,
    name: String,
    extension: String,
    contents: String,
) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("save as")
        .set_file_name(&name)
        .add_filter(&extension, &[extension.as_str()])
        .blocking_save_file();

    let Some(picked) = picked else { return Ok(None) };
    let path = picked
        .into_path()
        .map_err(|e| format!("cannot resolve path: {e}"))?;
    fs::write(&path, contents.as_bytes()).map_err(|e| format!("cannot write file: {e}"))?;
    Ok(Some(path.display().to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_store,
            save_store,
            save_image,
            load_image,
            delete_image,
            save_document_as
        ])
        .run(tauri::generate_context!())
        .expect("error while running libellus");
}
