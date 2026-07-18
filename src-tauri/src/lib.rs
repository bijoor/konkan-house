use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent};

// A file path the app was asked to open before the webview was ready
// (cold start via double-click on macOS, or a CLI arg on Windows/Linux).
// The frontend drains it once on boot via `take_pending_open`; warm opens
// (app already running) are pushed live via the `wadi://open-file` event.
struct PendingOpen(Mutex<Option<String>>);

#[tauri::command]
fn take_pending_open(state: tauri::State<'_, PendingOpen>) -> Option<String> {
  state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Windows/Linux hand the opened file to the process as a CLI argument;
  // macOS instead delivers it as an "open documents" apple event, handled
  // as RunEvent::Opened in the run loop below. Capture a launch arg here so
  // a cold start on Win/Linux has the path immediately.
  let initial = std::env::args()
    .skip(1)
    .find(|a| a.to_lowercase().ends_with(".wadi"));

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .manage(PendingOpen(Mutex::new(initial)))
    .invoke_handler(tauri::generate_handler![take_pending_open])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|app, event| {
      // macOS: Finder "Open" / `open file.wadi` (and, later, wadi:// deep
      // links) arrive here as URLs — both on cold start and while running.
      // Stash the path so a not-yet-ready webview can drain it on boot, and
      // emit an event so an already-running webview loads it live.
      if let RunEvent::Opened { urls } = event {
        for url in urls {
          let path = url
            .to_file_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| url.to_string());
          if let Some(state) = app.try_state::<PendingOpen>() {
            *state.0.lock().unwrap() = Some(path.clone());
          }
          let _ = app.emit("wadi://open-file", path);
        }
      }
    });
}
