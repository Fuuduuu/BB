use image::{codecs::jpeg::JpegEncoder, DynamicImage, ImageFormat, RgbImage};
use pcbk_desktop::storage::{CopyRequest, ProjectStore, Reason, SystemClock};
use rusqlite::Connection;
use std::{fs, io::Cursor, path::Path, sync::Arc};

fn store(path: &Path) -> ProjectStore {
    ProjectStore::new(path.join("app-data"), Arc::new(SystemClock))
}

fn create(store: &ProjectStore, path: &Path) -> String {
    store
        .create(path, "project", r#"{"format_version":1,"rev":0}"#)
        .unwrap()
        .session
}

fn jpeg(width: u32, height: u32) -> Vec<u8> {
    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut bytes, 90)
        .encode_image(&RgbImage::from_pixel(
            width,
            height,
            image::Rgb([45, 85, 125]),
        ))
        .unwrap();
    bytes
}

fn oriented_jpeg(orientation: u16) -> Vec<u8> {
    let mut app1 = b"Exif\0\0II\x2a\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0".to_vec();
    app1.extend_from_slice(&orientation.to_le_bytes());
    app1.extend_from_slice(&[0; 6]);
    let original = jpeg(9, 6);
    let mut bytes = original[..2].to_vec();
    bytes.extend_from_slice(&[0xff, 0xe1]);
    bytes.extend_from_slice(&((app1.len() + 2) as u16).to_be_bytes());
    bytes.extend_from_slice(&app1);
    bytes.extend_from_slice(&original[2..]);
    bytes
}

#[test]
fn exif_orientation_maps_to_photo_transform() {
    let dir = tempfile::tempdir().unwrap();
    let store = store(dir.path());
    let session = create(&store, &dir.path().join("photo.pcbk"));
    let transforms = [
        "none",
        "mirror",
        "rot180",
        "mirror_rot180",
        "mirror_rot270",
        "rot90",
        "mirror_rot90",
        "rot270",
    ];
    for (index, transform) in transforms.iter().enumerate() {
        let photo = store
            .import_photo_bytes(
                &session,
                &oriented_jpeg(index as u16 + 1),
                &format!("photo-{index}"),
                "Plaat",
            )
            .unwrap();
        assert_eq!(photo.transform, *transform);
        assert_eq!((photo.width_px, photo.height_px), (9, 6));
    }
    let photo = store
        .import_photo_bytes(&session, &jpeg(9, 6), "missing", "Plaat")
        .unwrap();
    assert_eq!(photo.transform, "none");
    let photo = store
        .import_photo_bytes(&session, &oriented_jpeg(42), "invalid", "Plaat")
        .unwrap();
    assert_eq!(photo.transform, "none");
    for (index, (field_type, count)) in [(4_u16, 1_u32), (1, 1), (3, 2)].into_iter().enumerate() {
        let mut malformed = oriented_jpeg(6);
        malformed[24..26].copy_from_slice(&field_type.to_le_bytes());
        malformed[26..30].copy_from_slice(&count.to_le_bytes());
        let photo = store
            .import_photo_bytes(&session, &malformed, &format!("malformed-{index}"), "Plaat")
            .unwrap();
        assert_eq!(photo.transform, "none");
    }
}

#[test]
fn photo_over_12mp_gets_display_variant() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("photo.pcbk");
    let store = store(dir.path());
    let session = create(&store, &path);
    let original = jpeg(4001, 3000);
    let photo = store
        .import_photo_bytes(&session, &original, "large", "Suur")
        .unwrap();
    assert_eq!((photo.width_px, photo.height_px), (4001, 3000));
    let display = store.photo_protocol(&format!("/photo/{session}/large?v=display"));
    assert_eq!(display.status, 200);
    assert_eq!(display.mime.as_deref(), Some("image/jpeg"));
    let decoded = image::load_from_memory(&display.bytes).unwrap();
    assert!(u64::from(decoded.width()) * u64::from(decoded.height()) <= 12_000_000);
    assert!(decoded.width() < 4001);
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{session}/large?v=original"))
            .bytes,
        original
    );
}

#[test]
fn original_bytes_stored_unchanged() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("photo.pcbk");
    let store = store(dir.path());
    let session = create(&store, &path);
    let original = oriented_jpeg(6);
    let source = dir.path().join("Plaat.vasak.JPG");
    fs::write(&source, &original).unwrap();
    let photo = store
        .import_photo_path(&session, &source, "photo-id")
        .unwrap();
    assert_eq!(photo.id, "photo-id");
    assert_eq!(photo.name, "Plaat.vasak");
    assert_eq!(photo.side, "top");
    let response = store.photo_protocol(&format!("/photo/{session}/photo-id?v=original"));
    assert_eq!(response.bytes, original);
    store.close(&session).unwrap();
    let conn = Connection::open(path).unwrap();
    let (bytes, count, dirty): (Vec<u8>, i64, String) = conn.query_row("SELECT bytes,(SELECT count(*) FROM photos),(SELECT value FROM meta WHERE key='media_dirty') FROM photos WHERE id='photo-id' AND variant='original'", [], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))).unwrap();
    assert_eq!(bytes, original);
    assert_eq!(count, 1);
    assert_eq!(dirty, "1");
}

#[test]
fn failed_import_leaves_no_rows() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("photo.pcbk");
    let store = store(dir.path());
    let session = create(&store, &path);
    let mut png = Cursor::new(Vec::new());
    DynamicImage::new_rgb8(8, 6)
        .write_to(&mut png, ImageFormat::Png)
        .unwrap();
    let mut truncated = png.into_inner();
    truncated.truncate(45); // Valid signature/IHDR dimensions, incomplete pixel data.
    for bytes in [truncated, vec![0xff, 0xd8, 0xff, 0xe0, 0, 2]] {
        assert_eq!(
            store
                .import_photo_bytes(&session, &bytes, "broken", "Katki")
                .unwrap_err()
                .reason,
            Reason::CorruptImage
        );
    }
    let mut jpeg = jpeg(120, 80);
    jpeg.truncate(jpeg.len() - 20);
    assert_eq!(
        store
            .import_photo_bytes(&session, &jpeg, "truncated-scan", "Katki")
            .unwrap_err()
            .reason,
        Reason::CorruptImage
    );
    store.close(&session).unwrap();
    let conn = Connection::open(path).unwrap();
    assert_eq!(
        conn.query_row("SELECT count(*) FROM photos", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        conn.query_row("SELECT value FROM meta WHERE key='media_dirty'", [], |r| {
            r.get::<_, String>(0)
        })
        .unwrap(),
        "0"
    );
}

#[test]
fn heic_is_rejected_with_reason() {
    let dir = tempfile::tempdir().unwrap();
    let store = store(dir.path());
    let session = create(&store, &dir.path().join("photo.pcbk"));
    assert_eq!(
        store
            .import_photo_bytes(
                &session,
                b"\0\0\0\x18ftypheic\0\0\0\0heicmif1",
                "heic",
                "HEIC"
            )
            .unwrap_err()
            .reason,
        Reason::UnsupportedImage
    );
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = !0_u32;
    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            crc = (crc >> 1) ^ (0xedb8_8320 & (0_u32.wrapping_sub(crc & 1)));
        }
    }
    !crc
}

#[test]
fn oversized_image_is_rejected_before_decode() {
    let dir = tempfile::tempdir().unwrap();
    let store = store(dir.path());
    let session = create(&store, &dir.path().join("photo.pcbk"));
    let mut png = Cursor::new(Vec::new());
    DynamicImage::new_rgb8(1, 1)
        .write_to(&mut png, ImageFormat::Png)
        .unwrap();
    let mut header = png.into_inner();
    header[16..20].copy_from_slice(&20_000_u32.to_be_bytes());
    header[20..24].copy_from_slice(&10_000_u32.to_be_bytes());
    let crc = crc32(&header[12..29]);
    header[29..33].copy_from_slice(&crc.to_be_bytes());
    // Pixel payload still describes 1px, proving dimensions are rejected first.
    assert_eq!(
        store
            .import_photo_bytes(&session, &header, "huge", "Suur")
            .unwrap_err()
            .reason,
        Reason::ImageTooLarge
    );
}

#[test]
fn prune_removes_unreferenced_photos() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("photo.pcbk");
    let store = store(dir.path());
    let session = create(&store, &path);
    let bytes = jpeg(5, 3);
    for id in ["keep", "orphan"] {
        store.import_photo_bytes(&session, &bytes, id, id).unwrap();
    }
    store.prune_photos(&session, &["keep".into()]).unwrap();
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{session}/keep?v=original"))
            .status,
        200
    );
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{session}/orphan?v=original"))
            .status,
        404
    );
    store.prune_photos(&session, &[]).unwrap();
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{session}/keep?v=original"))
            .status,
        404
    );
}

#[test]
fn protocol_serves_only_active_session() {
    let dir = tempfile::tempdir().unwrap();
    let store = store(dir.path());
    let first = create(&store, &dir.path().join("first.pcbk"));
    let bytes = jpeg(5, 3);
    store
        .import_photo_bytes(&first, &bytes, "photo", "Plaat")
        .unwrap();
    let response = store.photo_protocol(&format!("/photo/{first}/photo?v=display"));
    assert_eq!(response.status, 200);
    assert_eq!(response.mime.as_deref(), Some("image/jpeg"));
    assert_eq!(response.cache_control, "no-store");
    for route in [
        format!("/photo/{first}/missing?v=display"),
        "/photo/wrong/photo?v=display".to_string(),
        format!("/photo/{first}/photo/extra?v=display"),
        format!("/photo/{first}/photo?v=bad"),
        format!("/photo/{first}/photo?v=original&v=display"),
    ] {
        assert_eq!(store.photo_protocol(&route).status, 404, "{route}");
    }
    let second = create(&store, &dir.path().join("second.pcbk"));
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{first}/photo?v=original"))
            .status,
        404
    );
    store.close(&second).unwrap(); // Failed new project preparation restores the former live handle.
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{first}/photo?v=original"))
            .bytes,
        bytes
    );
    store.close(&first).unwrap();
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{first}/photo?v=original"))
            .status,
        404
    );
}

#[test]
fn copy_contains_original_photo() {
    let dir = tempfile::tempdir().unwrap();
    let store = store(dir.path());
    let first = create(&store, &dir.path().join("first.pcbk"));
    let bytes = jpeg(7, 4);
    store
        .import_photo_bytes(&first, &bytes, "photo", "Plaat")
        .unwrap();
    let copied = store
        .copy(CopyRequest {
            session: &first,
            dest: &dir.path().join("copy.pcbk"),
            project_id: "project",
            copied_from_project_id: None,
            doc_json: r#"{"format_version":1,"rev":0}"#,
            rev: 0,
            view_json: None,
            journal: &[],
        })
        .unwrap();
    assert!(!copied.from_memory);
    assert_eq!(
        store
            .photo_protocol(&format!(
                "/photo/{}/photo?v=original",
                copied.opened.session
            ))
            .bytes,
        bytes
    );
}
