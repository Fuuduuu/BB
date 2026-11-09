#![cfg(feature = "tauri-ipc")]

use std::path::Path;

use tauri::State;

use crate::storage::{JournalDto, OpenedProjectDto, ProjectStore, StorageErrorDto};

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
pub fn project_close(
    store: State<'_, ProjectStore>,
    session: String,
) -> Result<(), StorageErrorDto> {
    store.close(&session)
}
