use image::{codecs::jpeg::JpegEncoder, RgbImage};
use pcbk_desktop::storage::{ProjectStore, SystemClock};
use rusqlite::Connection;
use std::sync::Arc;

#[test]
fn display_insert_failure_rolls_back_original_and_media_dirty() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("photo.pcbk");
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
    let opened = store
        .create(&path, "project", r#"{"format_version":1,"rev":0}"#)
        .unwrap();
    store.close(&opened.session).unwrap();
    Connection::open(&path)
        .unwrap()
        .execute_batch(
            "CREATE TRIGGER fail_display BEFORE INSERT ON photos WHEN NEW.variant='display'
         BEGIN SELECT RAISE(ABORT,'synthetic display write failure'); END;",
        )
        .unwrap();
    let opened = store.open(&path).unwrap();
    let mut jpeg = Vec::new();
    JpegEncoder::new_with_quality(&mut jpeg, 90)
        .encode_image(&RgbImage::new(4001, 3000))
        .unwrap();
    assert!(store
        .import_photo_bytes(&opened.session, &jpeg, "photo", "Plaat")
        .is_err());
    store.close(&opened.session).unwrap();
    let conn = Connection::open(path).unwrap();
    assert_eq!(
        conn.query_row("SELECT count(*) FROM photos", [], |row| row
            .get::<_, u32>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        conn.query_row(
            "SELECT value FROM meta WHERE key='media_dirty'",
            [],
            |row| row.get::<_, String>(0)
        )
        .unwrap(),
        "0"
    );
}
