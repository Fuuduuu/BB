#![cfg(feature = "tauri-ipc")]

use std::{path::Path, sync::Mutex};

use tauri::{AppHandle, Manager, Runtime, State};

use crate::storage::{
    BackupInfoDto, CopyRequest, CopyResultDto, JournalDto, OpenedProjectDto, ProjectStore, Reason,
    RecentDto, StorageErrorDto,
};

pub struct InitialPath(Mutex<OpenPathState>);

struct OpenPathState {
    pending: Option<String>,
    listening: bool,
}

impl InitialPath {
    pub fn new(path: Option<String>) -> Self {
        Self(Mutex::new(OpenPathState {
            pending: path,
            listening: false,
        }))
    }

    pub fn hold_until_ready(&self, path: String) -> Option<String> {
        let Ok(mut state) = self.0.lock() else {
            return Some(path);
        };
        if state.listening {
            Some(path)
        } else {
            state.pending = Some(path);
            None
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn take_initial_path(state: State<'_, InitialPath>) -> Result<Option<String>, StorageErrorDto> {
    let mut paths = state
        .0
        .lock()
        .map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
    paths.listening = true;
    Ok(paths.pending.take())
}

#[tauri::command(rename_all = "snake_case")]
pub fn default_project_path<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    near: Option<String>,
) -> Result<String, StorageErrorDto> {
    let path = if let Some(near) = near.as_deref() {
        let near = project_file(near)?;
        let directory = near
            .parent()
            .filter(|_| near.is_absolute())
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
        crate::desktop_paths::available_project_path(directory, &name)?
    } else {
        let documents = app
            .path()
            .document_dir()
            .map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
        crate::desktop_paths::default_project_path(&documents, &name)?
    };
    path.into_os_string()
        .into_string()
        .map_err(|_| StorageErrorDto::new(Reason::Unknown))
}

#[tauri::command(rename_all = "snake_case")]
pub fn log_export<R: Runtime>(app: AppHandle<R>, dest: String) -> Result<(), StorageErrorDto> {
    let dest = Path::new(&dest);
    if !dest
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("txt"))
    {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    let logs = app
        .path()
        .app_log_dir()
        .map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
    log::logger().flush();
    crate::logging::export(
        &logs,
        dest,
        &app.package_info().version.to_string(),
        chrono::Utc::now(),
    )?;
    Ok(())
}

fn project_file(path: &str) -> Result<&Path, StorageErrorDto> {
    let path = Path::new(path);
    if path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pcbk"))
    {
        Ok(path)
    } else {
        Err(StorageErrorDto::new(Reason::NotProject))
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_create(
    store: State<'_, ProjectStore>,
    path: String,
    project_id: String,
    doc_json: String,
) -> Result<OpenedProjectDto, StorageErrorDto> {
    store.create(project_file(&path)?, &project_id, &doc_json)
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_open(
    store: State<'_, ProjectStore>,
    path: String,
) -> Result<OpenedProjectDto, StorageErrorDto> {
    store.open(project_file(&path)?)
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_save(
    store: State<'_, ProjectStore>,
    session: String,
    base_rev: i64,
    rev: i64,
    doc_json: String,
    journal: Vec<JournalDto>,
) -> Result<(), StorageErrorDto> {
    store.save(&session, base_rev, rev, &doc_json, &journal)
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_save_view(
    store: State<'_, ProjectStore>,
    session: String,
    view_json: String,
) -> Result<(), StorageErrorDto> {
    store.save_view(&session, &view_json)
}

#[tauri::command(rename_all = "snake_case")]
#[allow(clippy::too_many_arguments)]
pub fn project_copy(
    store: State<'_, ProjectStore>,
    session: String,
    dest: String,
    project_id: String,
    copied_from_project_id: Option<String>,
    doc_json: String,
    rev: i64,
    view_json: Option<String>,
    journal: Vec<JournalDto>,
) -> Result<CopyResultDto, StorageErrorDto> {
    store.copy(CopyRequest {
        session: &session,
        dest: project_file(&dest)?,
        project_id: &project_id,
        copied_from_project_id: copied_from_project_id.as_deref(),
        doc_json: &doc_json,
        rev,
        view_json: view_json.as_deref(),
        journal: &journal,
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_backup_full(
    store: State<'_, ProjectStore>,
    session: String,
    reason: String,
) -> Result<(), StorageErrorDto> {
    if reason != "migration" {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    store.backup_full(&session)
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_backups(
    store: State<'_, ProjectStore>,
    project_id: String,
) -> Result<Vec<BackupInfoDto>, StorageErrorDto> {
    store.backups(&project_id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_restore(
    store: State<'_, ProjectStore>,
    backup: String,
    dest: String,
) -> Result<OpenedProjectDto, StorageErrorDto> {
    store.restore(Path::new(&backup), project_file(&dest)?)
}

#[tauri::command(rename_all = "snake_case")]
pub fn recent_list(store: State<'_, ProjectStore>) -> Result<Vec<RecentDto>, StorageErrorDto> {
    store.recent_list()
}

#[tauri::command(rename_all = "snake_case")]
pub fn recent_add(
    store: State<'_, ProjectStore>,
    path: String,
    name: String,
    project_id: String,
) -> Result<(), StorageErrorDto> {
    store.recent_add(project_file(&path)?, &name, &project_id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn recent_remove(store: State<'_, ProjectStore>, path: String) -> Result<(), StorageErrorDto> {
    store.recent_remove(Path::new(&path))
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_close(
    store: State<'_, ProjectStore>,
    session: String,
) -> Result<(), StorageErrorDto> {
    store.close(&session)
}
