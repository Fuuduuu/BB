#![cfg(feature = "tauri-ipc")]

use crate::storage::{
    photo_protocol::decode_component, PhotoRefDto, ProjectStore, Reason, StorageErrorDto,
};
use std::path::Path;
use tauri::{
    ipc::{InvokeBody, Request},
    AppHandle, Manager, Runtime, State,
};

#[tauri::command(rename_all = "snake_case")]
pub async fn photo_import_path<R: Runtime>(
    app: AppHandle<R>,
    session: String,
    path: String,
    id: String,
) -> Result<PhotoRefDto, StorageErrorDto> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<ProjectStore>()
            .import_photo_path(&session, Path::new(&path), &id)
    })
    .await
    .map_err(|_| StorageErrorDto::new(Reason::Unknown))?
}

fn header(request: &Request<'_>, name: &str) -> Result<String, StorageErrorDto> {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .and_then(decode_component)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))
}

#[tauri::command]
pub async fn photo_import_bytes<R: Runtime>(
    app: AppHandle<R>,
    request: Request<'_>,
) -> Result<PhotoRefDto, StorageErrorDto> {
    let session = header(&request, "x-photo-session")?;
    let id = header(&request, "x-photo-id")?;
    let name = header(&request, "x-photo-name")?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(StorageErrorDto::new(Reason::Unknown));
    };
    let bytes = bytes.clone();
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<ProjectStore>()
            .import_photo_bytes(&session, &bytes, &id, &name)
    })
    .await
    .map_err(|_| StorageErrorDto::new(Reason::Unknown))?
}

#[tauri::command(rename_all = "snake_case")]
pub fn photo_prune(
    store: State<'_, ProjectStore>,
    session: String,
    keep: Vec<String>,
) -> Result<(), StorageErrorDto> {
    store.prune_photos(&session, &keep)
}
