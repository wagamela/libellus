use std::fs;
use std::io::Write;
use std::path::PathBuf;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;
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

/// Rust is formatted by the user's own rustfmt: there is no formatter for it
/// that runs in the webview without dropping comments. Code goes in on stdin and
/// comes back on stdout, so nothing is written to disk.
#[tauri::command(async)]
fn format_rust(code: String) -> Result<String, String> {
    use std::process::{Command, Stdio};
    let mut child = Command::new("rustfmt")
        .args(["--emit", "stdout", "--edition", "2021"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "rustfmt is not installed".to_string())?;
    child
        .stdin
        .take()
        .ok_or("cannot reach rustfmt")?
        .write_all(code.as_bytes())
        .map_err(|e| format!("cannot write to rustfmt: {e}"))?;
    let output = child
        .wait_with_output()
        .map_err(|e| format!("rustfmt failed: {e}"))?;
    if !output.status.success() {
        return Err("rust code does not parse".into());
    }
    String::from_utf8(output.stdout).map_err(|_| "rustfmt returned invalid text".into())
}

/// Secret values are handed to the OS credential store and never touch
/// libellus's own files. Each one is keyed by the secret's id; the name and
/// timestamps stay in the store as ordinary metadata.
///
/// Errors are fixed strings: the keyring's own messages are never forwarded,
/// so nothing a caller logs can carry a value.
const SECRET_SERVICE: &str = "libellus";

fn secret_entry(id: &str) -> Result<keyring::Entry, String> {
    // Ids come from the frontend; only the UUIDs it generates are accepted.
    let safe = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
    if !safe {
        return Err("invalid secret id".into());
    }
    keyring::Entry::new(SECRET_SERVICE, id).map_err(|_| "secure storage is unavailable".into())
}

#[tauri::command(async)]
fn set_secret(id: String, value: String) -> Result<(), String> {
    secret_entry(&id)?
        .set_password(&value)
        .map_err(|_| "cannot store secret".into())
}

#[tauri::command(async)]
fn get_secret(id: String) -> Result<Option<String>, String> {
    match secret_entry(&id)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("cannot read secret".into()),
    }
}

#[tauri::command(async)]
fn delete_secret(id: String) -> Result<(), String> {
    match secret_entry(&id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("cannot delete secret".into()),
    }
}

/// How long a copied secret stays on the clipboard.
/// shortcut: fixed period, make it a setting once libellus has settings.
const CLIPBOARD_CLEAR_SECS: u64 = 30;

/// Copies a secret without it ever entering the webview: the value goes from
/// the keychain straight to the clipboard, and is cleared again after
/// `CLIPBOARD_CLEAR_SECS` unless something else has been copied since. The
/// clipboard plugin is used from here only; the frontend has no clipboard
/// permission. Returns the clear delay so the UI can say when it happens.
#[tauri::command(async)]
fn copy_secret(app: tauri::AppHandle, id: String) -> Result<u64, String> {
    let value = match secret_entry(&id)?.get_password() {
        Ok(value) => value,
        Err(keyring::Error::NoEntry) => return Err("the keychain has no value for this secret".into()),
        Err(_) => return Err("cannot read secret".into()),
    };
    app.clipboard()
        .write_text(value.as_str())
        .map_err(|_| "cannot copy secret".to_string())?;
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(CLIPBOARD_CLEAR_SECS));
        let clipboard = app.clipboard();
        if clipboard.read_text().ok().as_deref() == Some(value.as_str()) {
            let _ = clipboard.clear();
        }
    });
    Ok(CLIPBOARD_CLEAR_SECS)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            load_store,
            save_store,
            save_image,
            load_image,
            delete_image,
            save_document_as,
            format_rust,
            set_secret,
            get_secret,
            delete_secret,
            copy_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running libellus");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_ids_are_uuids_only() {
        assert!(secret_entry("../store").is_err());
        assert!(secret_entry("").is_err());
        assert!(secret_entry("x").is_err());
    }

    /// Talks to the real OS credential store: `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn secret_round_trip() {
        let id = "00000000-0000-4000-8000-000000000000".to_string();
        set_secret(id.clone(), "hunter2".into()).unwrap();
        assert_eq!(get_secret(id.clone()).unwrap().as_deref(), Some("hunter2"));
        delete_secret(id.clone()).unwrap();
        assert_eq!(get_secret(id).unwrap(), None);
    }
}
