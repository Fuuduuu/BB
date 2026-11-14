#[path = "support/jpeg_fixtures.rs"]
mod jpeg_fixtures;
use image::{codecs::jpeg::JpegEncoder, DynamicImage, ImageFormat, RgbImage};
use pcbk_desktop::storage::{ProjectStore, Reason, SystemClock};
use rusqlite::Connection;
use std::{io::Cursor, sync::Arc};

fn setup() -> (tempfile::TempDir, ProjectStore, String) {
    let dir = tempfile::tempdir().unwrap();
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
    let opened = store
        .create(
            &dir.path().join("photo.pcbk"),
            "project",
            r#"{"format_version":1,"rev":0}"#,
        )
        .unwrap();
    (dir, store, opened.session)
}
fn baseline_jpeg() -> Vec<u8> {
    let mut jpeg = Vec::new();
    JpegEncoder::new_with_quality(&mut jpeg, 90)
        .encode_image(&RgbImage::new(120, 80))
        .unwrap();
    jpeg
}
fn progressive_jpeg() -> Vec<u8> {
    fn segment(jpeg: &mut Vec<u8>, marker: u8, payload: &[u8]) {
        jpeg.extend_from_slice(&[0xff, marker]);
        jpeg.extend_from_slice(&((payload.len() + 2) as u16).to_be_bytes());
        jpeg.extend_from_slice(payload);
    }
    let mut jpeg = vec![0xff, 0xd8];
    let mut quantization = vec![0];
    quantization.extend_from_slice(&[1; 64]);
    segment(&mut jpeg, 0xdb, &quantization);
    segment(&mut jpeg, 0xc2, &[8, 0, 8, 0, 8, 1, 1, 0x11, 0]);
    for table in [0, 0x10] {
        let mut huffman = vec![table, 1];
        huffman.extend_from_slice(&[0; 15]);
        huffman.push(0);
        segment(&mut jpeg, 0xc4, &huffman);
    }
    segment(&mut jpeg, 0xda, &[1, 1, 0, 0, 0, 0]);
    jpeg.push(0x7f); // DC category 0 with alignment padding.
    segment(&mut jpeg, 0xda, &[1, 1, 0, 1, 63, 0]);
    jpeg.push(0x7f); // AC EOB with alignment padding.
    jpeg.extend_from_slice(&[0xff, 0xd9]);
    jpeg
}
fn rejected_without_rows(bytes: &[u8], reason: Reason) {
    let (dir, store, session) = setup();
    assert_eq!(
        store
            .import_photo_bytes(&session, bytes, "photo", "Plaat")
            .unwrap_err()
            .reason,
        reason
    );
    store.close(&session).unwrap();
    let conn = Connection::open(dir.path().join("photo.pcbk")).unwrap();
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

#[test]
fn truncated_progressive_jpeg_is_corrupt() {
    let jpeg = progressive_jpeg();
    for removed in [1, 2, 8] {
        rejected_without_rows(&jpeg[..jpeg.len() - removed], Reason::CorruptImage);
    }
}
#[test]
fn truncated_baseline_jpeg_is_corrupt() {
    let jpeg = baseline_jpeg();
    for removed in [1, 2, 20] {
        rejected_without_rows(&jpeg[..jpeg.len() - removed], Reason::CorruptImage);
    }
}
#[test]
fn non_interleaved_baseline_jpeg_is_unsupported() {
    for extended in [false, true] {
        for subsampling in [false, true] {
            for restart in [0, 2] {
                let mut bytes = jpeg_fixtures::fixture(17, 19, subsampling, restart, true);
                if extended {
                    let sof = bytes
                        .windows(2)
                        .position(|bytes| bytes == [0xff, 0xc0])
                        .unwrap();
                    bytes[sof + 1] = 0xc1;
                }
                rejected_without_rows(&bytes, Reason::UnsupportedImage);
            }
        }
    }
}
#[test]
fn progressive_jpeg_imports() {
    let (_dir, store, session) = setup();
    let bytes = progressive_jpeg();
    let photo = store
        .import_photo_bytes(&session, &bytes, "progressive", "Järk")
        .unwrap();
    assert_eq!((photo.width_px, photo.height_px), (8, 8));
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{session}/progressive?v=original"))
            .bytes,
        bytes
    );
}
#[test]
fn trailing_bytes_after_eoi_are_accepted() {
    let (_dir, store, session) = setup();
    for (index, mut bytes) in [baseline_jpeg(), progressive_jpeg()]
        .into_iter()
        .enumerate()
    {
        bytes.extend_from_slice(b"trailing bytes after EOI");
        let id = format!("trailing-{index}");
        store
            .import_photo_bytes(&session, &bytes, &id, "Plaat")
            .unwrap();
        assert_eq!(
            store
                .photo_protocol(&format!("/photo/{session}/{id}?v=original"))
                .bytes,
            bytes
        );
    }
}
#[test]
fn interleaved_baseline_restart_and_extended_variants_import() {
    let (_dir, store, session) = setup();
    let mut cases = vec![
        jpeg_fixtures::fixture(17, 19, false, 2, false),
        jpeg_fixtures::fixture(17, 19, true, 2, false),
        jpeg_fixtures::grayscale_fixture(17, 19, 2),
    ];
    let mut extended = cases[0].clone();
    let sof = extended
        .windows(2)
        .position(|bytes| bytes == [0xff, 0xc0])
        .unwrap();
    extended[sof + 1] = 0xc1;
    cases.push(extended);
    for (index, bytes) in cases.iter().enumerate() {
        let photo = store
            .import_photo_bytes(&session, bytes, &format!("supported-{index}"), "Plaat")
            .unwrap();
        assert_eq!((photo.width_px, photo.height_px), (17, 19));
    }
}
#[test]
fn unsupported_sof_variants_are_rejected() {
    for marker in [
        0xc3, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf,
    ] {
        let mut bytes = baseline_jpeg();
        let sof = bytes
            .windows(2)
            .position(|bytes| bytes == [0xff, 0xc0])
            .unwrap();
        bytes[sof + 1] = marker;
        rejected_without_rows(&bytes, Reason::UnsupportedImage);
    }
}
#[test]
fn missing_png_iend_is_corrupt() {
    let mut png = Cursor::new(Vec::new());
    DynamicImage::new_rgb8(12, 8)
        .write_to(&mut png, ImageFormat::Png)
        .unwrap();
    let mut bytes = png.into_inner();
    bytes.truncate(bytes.len() - 12);
    rejected_without_rows(&bytes, Reason::CorruptImage);
}
#[test]
fn valid_jpeg_wider_than_16384_is_not_rejected() {
    let (_dir, store, session) = setup();
    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut bytes, 90)
        .encode_image(&RgbImage::new(20_000, 10))
        .unwrap();
    let photo = store
        .import_photo_bytes(&session, &bytes, "wide", "Lai")
        .unwrap();
    assert_eq!((photo.width_px, photo.height_px), (20_000, 10));
}
