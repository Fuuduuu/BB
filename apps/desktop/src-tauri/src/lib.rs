#[cfg(any(feature = "tauri-ipc", test))]
mod desktop_paths;
#[cfg(feature = "tauri-ipc")]
pub mod ipc;
#[cfg(feature = "tauri-ipc")]
pub mod ipc_photo;
#[cfg(any(feature = "tauri-ipc", test))]
mod logging;
pub mod storage;

#[cfg(any(feature = "tauri-ipc", test))]
fn photo_protocol_probe_request(path_and_query: &str) -> (&str, Option<&'static str>) {
    // P3 is temporary debug instrumentation. The storage route remains strict;
    // only this opt-in URL is adapted before it reaches the existing protocol.
    #[cfg(debug_assertions)]
    if let Some((canonical, encoded_origin)) = path_and_query.split_once("&png_probe_origin=") {
        if matches!(
            canonical.split_once('?').map(|(_, query)| query),
            Some("v=display" | "v=original")
        ) {
            let origin = match encoded_origin {
                "http%3A%2F%2F127.0.0.1%3A1420" => Some("http://127.0.0.1:1420"),
                "http%3A%2F%2Flocalhost%3A1420" => Some("http://localhost:1420"),
                "http%3A%2F%2Ftauri.localhost" => Some("http://tauri.localhost"),
                _ => None,
            };
            if origin.is_some() {
                return (canonical, origin);
            }
        }
    }
    (path_and_query, None)
}

#[cfg(feature = "tauri-ipc")]
pub fn photo_protocol_response(
    store: &storage::ProjectStore,
    path_and_query: &str,
) -> tauri::http::Response<Vec<u8>> {
    let (path_and_query, _probe_origin) = photo_protocol_probe_request(path_and_query);
    let photo = store.photo_protocol(path_and_query);
    let mut response = tauri::http::Response::builder()
        .status(photo.status)
        .header(tauri::http::header::CACHE_CONTROL, photo.cache_control);
    if let Some(mime) = photo.mime {
        response = response.header(tauri::http::header::CONTENT_TYPE, mime);
    }
    #[cfg(debug_assertions)]
    if let Some(origin) = _probe_origin {
        response = response.header(tauri::http::header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
    }
    response
        .body(photo.bytes)
        .expect("photo response uses valid static headers")
}

#[cfg(test)]
mod tests {
    use super::photo_protocol_probe_request;

    #[test]
    fn photo_protocol_cors_header_only_in_debug() {
        // P1/P2 retain the ordinary protocol contract, including anonymous P2.
        for variant in ["display", "original"] {
            let normal = format!("/photo/session/image?v={variant}");
            assert_eq!(
                photo_protocol_probe_request(&normal),
                (normal.as_str(), None)
            );
            for (encoded, origin) in [
                ("http%3A%2F%2F127.0.0.1%3A1420", "http://127.0.0.1:1420"),
                ("http%3A%2F%2Flocalhost%3A1420", "http://localhost:1420"),
                ("http%3A%2F%2Ftauri.localhost", "http://tauri.localhost"),
            ] {
                let probe = format!("{normal}&png_probe_origin={encoded}");
                let (route, header) = photo_protocol_probe_request(&probe);
                #[cfg(debug_assertions)]
                {
                    assert_eq!(route, normal);
                    assert_eq!(header, Some(origin));
                }
                #[cfg(not(debug_assertions))]
                {
                    let _ = origin;
                    assert_eq!(route, probe);
                    assert_eq!(header, None);
                }
            }
            for origin in [
                "*",
                "http://localhost:1420",
                "https%3A%2F%2Fevil.example",
                "http%3A%2F%2Flocalhost%3A1420.evil.example",
                "http%3A%2F%2Flocalhost%3A1420&extra=1",
                "http%3A%2F%2Flocalhost%3A1420&png_probe_origin=*",
            ] {
                let invalid = format!("{normal}&png_probe_origin={origin}");
                assert_eq!(
                    photo_protocol_probe_request(&invalid),
                    (invalid.as_str(), None)
                );
            }
        }
        for invalid in [
            "/photo/session/image?v=other&png_probe_origin=http%3A%2F%2Flocalhost%3A1420",
            "/photo/session/image?v=display&extra=1&png_probe_origin=http%3A%2F%2Flocalhost%3A1420",
        ] {
            assert_eq!(photo_protocol_probe_request(invalid), (invalid, None));
        }

        #[cfg(feature = "tauri-ipc")]
        {
            use super::{
                photo_protocol_response,
                storage::{ProjectStore, SystemClock},
            };
            use std::{io::Cursor, sync::Arc};
            let dir = tempfile::tempdir().unwrap();
            let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
            let session = store
                .create(
                    &dir.path().join("probe.pcbk"),
                    "probe",
                    r#"{"format_version":1,"rev":0}"#,
                )
                .unwrap()
                .session;
            let mut bytes = Cursor::new(Vec::new());
            image::DynamicImage::new_rgb8(2, 2)
                .write_to(&mut bytes, image::ImageFormat::Png)
                .unwrap();
            store
                .import_photo_bytes(&session, bytes.get_ref(), "image", "Probe")
                .unwrap();
            for variant in ["display", "original"] {
                let normal = format!("/photo/{session}/image?v={variant}");
                let plain = photo_protocol_response(&store, &normal);
                assert_eq!(plain.status(), 200);
                assert!(!plain.headers().contains_key("Access-Control-Allow-Origin"));
                let probe = photo_protocol_response(
                    &store,
                    &format!("{normal}&png_probe_origin=http%3A%2F%2Flocalhost%3A1420"),
                );
                #[cfg(debug_assertions)]
                {
                    assert_eq!(probe.status(), 200);
                    assert_eq!(
                        probe.headers()["Access-Control-Allow-Origin"],
                        "http://localhost:1420"
                    );
                    assert_eq!(
                        probe.headers()["Cache-Control"],
                        plain.headers()["Cache-Control"]
                    );
                    assert_eq!(
                        probe.headers()["Content-Type"],
                        plain.headers()["Content-Type"]
                    );
                    assert_eq!(probe.body(), plain.body());
                }
                #[cfg(not(debug_assertions))]
                {
                    assert_eq!(probe.status(), 404);
                    assert!(!probe.headers().contains_key("Access-Control-Allow-Origin"));
                }
                let bad = photo_protocol_response(&store, &format!("{normal}&png_probe_origin=*"));
                assert_eq!(bad.status(), 404);
                assert!(!bad.headers().contains_key("Access-Control-Allow-Origin"));
            }
        }
    }
}
