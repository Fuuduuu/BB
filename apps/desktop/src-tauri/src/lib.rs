#[cfg(any(feature = "tauri-ipc", test))]
mod desktop_paths;
#[cfg(feature = "tauri-ipc")]
pub mod ipc;
#[cfg(feature = "tauri-ipc")]
pub mod ipc_photo;
#[cfg(any(feature = "tauri-ipc", test))]
mod logging;
pub mod storage;

#[cfg(feature = "tauri-ipc")]
pub fn photo_protocol_response(
    store: &storage::ProjectStore,
    path_and_query: &str,
) -> tauri::http::Response<Vec<u8>> {
    let photo = store.photo_protocol(path_and_query);
    let mut response = tauri::http::Response::builder()
        .status(photo.status)
        .header(tauri::http::header::CACHE_CONTROL, photo.cache_control);
    if let Some(mime) = photo.mime {
        response = response.header(tauri::http::header::CONTENT_TYPE, mime);
    }
    response
        .body(photo.bytes)
        .expect("photo response uses valid static headers")
}
