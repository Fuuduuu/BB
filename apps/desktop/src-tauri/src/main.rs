#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env,
    path::{Path, PathBuf},
    sync::Arc,
};

use pcbk_desktop::{
    ipc::{self, InitialPath},
    ipc_photo,
    storage::{ProjectStore, SystemClock},
};
use tauri::{Emitter, Manager};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

fn project_argument(args: impl IntoIterator<Item = PathBuf>, cwd: &Path) -> Option<String> {
    args.into_iter().skip(1).find_map(|argument| {
        if !argument
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("pcbk"))
        {
            return None;
        }
        let path = if argument.is_absolute() {
            argument
        } else {
            cwd.join(argument)
        };
        dunce::canonicalize(&path)
            .unwrap_or(path)
            .into_os_string()
            .into_string()
            .ok()
    })
}

fn main() {
    let initial = project_argument(
        env::args_os().map(PathBuf::from),
        &env::current_dir().unwrap_or_default(),
    );
    tauri::Builder::default()
        .register_asynchronous_uri_scheme_protocol("pcbk", |context, request, responder| {
            let app = context.app_handle().clone();
            std::thread::spawn(move || {
                let route = if request.method() == tauri::http::Method::GET {
                    request
                        .uri()
                        .path_and_query()
                        .map(|value| value.as_str())
                        .unwrap_or("")
                } else {
                    ""
                };
                responder.respond(pcbk_desktop::photo_protocol_response(
                    &app.state::<ProjectStore>(),
                    route,
                ));
            });
        })
        .manage(InitialPath::new(initial))
        .plugin(tauri_plugin_single_instance::init(|app, arguments, cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            if let Some(path) =
                project_argument(arguments.into_iter().map(PathBuf::from), Path::new(&cwd))
                    .and_then(|path| app.state::<InitialPath>().hold_until_ready(path))
            {
                if let Err(error) = app.emit_to("main", "project:open-path", path) {
                    log::warn!("Could not deliver project open request: {error}");
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([Target::new(TargetKind::LogDir {
                    file_name: Some("pcbk".into()),
                })])
                .max_file_size(1024 * 1024)
                // The active file is not counted among the rotated files.
                .rotation_strategy(RotationStrategy::KeepSome(4))
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            app.manage(ProjectStore::new(
                app.path().app_data_dir()?,
                Arc::new(SystemClock),
            ));
            log::info!("PCB Kaardistaja {} käivitati", app.package_info().version);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::project_create,
            ipc::project_open,
            ipc::project_save,
            ipc::project_save_view,
            ipc::project_copy,
            ipc::project_backup_full,
            ipc::project_backups,
            ipc::project_restore,
            ipc::recent_list,
            ipc::recent_add,
            ipc::recent_remove,
            ipc::project_close,
            ipc_photo::photo_import_path,
            ipc_photo::photo_import_bytes,
            ipc_photo::photo_prune,
            ipc::default_project_path,
            ipc::take_initial_path,
            ipc::log_export,
        ])
        .run(tauri::generate_context!())
        .expect("PCB Kaardistaja ei käivitunud");
}
