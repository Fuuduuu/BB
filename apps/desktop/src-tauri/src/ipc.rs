#![cfg(feature = "tauri-ipc")]

use std::path::Path;

use tauri::State;

use crate::storage::{
    BackupInfoDto, CopyRequest, CopyResultDto, JournalDto, OpenedProjectDto, ProjectStore, Reason,
    RecentDto, StorageErrorDto,
};

#[tauri::command(rename_all = "snake_case")]
pub fn project_create(
    store: State<'_, ProjectStore>,
    path: String,
    project_id: String,
    doc_json: String,
) -> Result<OpenedProjectDto, StorageErrorDto> {
    store.create(Path::new(&path), &project_id, &doc_json)
}

#[tauri::command(rename_all = "snake_case")]
pub fn project_open(
    store: State<'_, ProjectStore>,
    path: String,
) -> Result<OpenedProjectDto, StorageErrorDto> {
    store.open(Path::new(&path))
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
        dest: Path::new(&dest),
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
    store.restore(Path::new(&backup), Path::new(&dest))
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
    store.recent_add(Path::new(&path), &name, &project_id)
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
