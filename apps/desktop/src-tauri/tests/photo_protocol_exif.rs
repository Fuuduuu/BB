use image::{codecs::jpeg::JpegEncoder, DynamicImage, ImageFormat, RgbImage};
use pcbk_desktop::storage::{ProjectStore, SystemClock};
use rusqlite::{params, Connection};
use std::{fs, io::Cursor, sync::Arc};

fn tempdir() -> tempfile::TempDir {
    let root = std::env::temp_dir().join("bb-m1-2-katse");
    fs::create_dir_all(&root).unwrap();
    tempfile::tempdir_in(root).unwrap()
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

fn tiff(big: bool) -> Vec<u8> {
    if big {
        b"MM\0\x2a\0\0\0\x08\0\x01\x01\x12\0\x03\0\0\0\x01\0\x06\0\0\0\0\0\0".to_vec()
    } else {
        b"II\x2a\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0\x06\0\0\0\0\0\0\0".to_vec()
    }
}

fn with_jpeg_exif(original: &[u8], tiff: &[u8]) -> Vec<u8> {
    let mut bytes = original[..2].to_vec();
    bytes.extend_from_slice(&[0xff, 0xe1]);
    bytes.extend_from_slice(&((tiff.len() + 8) as u16).to_be_bytes());
    bytes.extend_from_slice(b"Exif\0\0");
    bytes.extend_from_slice(tiff);
    bytes.extend_from_slice(&original[2..]);
    bytes
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = !0_u32;
    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            crc = (crc >> 1) ^ (0xedb8_8320 & 0_u32.wrapping_sub(crc & 1));
        }
    }
    !crc
}

fn with_png_exif(tiff: &[u8]) -> Vec<u8> {
    let mut png = Cursor::new(Vec::new());
    DynamicImage::new_rgb8(9, 6)
        .write_to(&mut png, ImageFormat::Png)
        .unwrap();
    let original = png.into_inner();
    let mut bytes = original[..33].to_vec(); // Immediately after IHDR.
    bytes.extend_from_slice(&(tiff.len() as u32).to_be_bytes());
    bytes.extend_from_slice(b"eXIf");
    bytes.extend_from_slice(tiff);
    let crc = crc32(&bytes[37..]);
    bytes.extend_from_slice(&crc.to_be_bytes());
    bytes.extend_from_slice(&original[33..]);
    bytes
}

fn orientation(bytes: &[u8]) -> Option<u32> {
    let exif = exif::Reader::new()
        .read_from_container(&mut Cursor::new(bytes))
        .ok()?;
    exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)?
        .value
        .get_uint(0)
}

fn rows(conn: &Connection) -> Vec<(String, String, Vec<u8>)> {
    conn.prepare("SELECT id,variant,bytes FROM photos ORDER BY id,variant")
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}

#[test]
fn display_response_neutralizes_exif_orientation_and_original_stays_identical() {
    let dir = tempdir();
    let path = dir.path().join("exif.pcbk");
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
    let mut session = store
        .create(&path, "project", r#"{"format_version":1,"rev":0}"#)
        .unwrap()
        .session;
    let original = jpeg(9, 6);
    let mut trailing_png_ii = with_png_exif(&tiff(false));
    trailing_png_ii.extend_from_slice(b"\0after-IEND");
    let mut trailing_png_mm = with_png_exif(&tiff(true));
    trailing_png_mm.extend_from_slice(b"\0after-IEND");
    let fixtures = [
        (
            "jpeg-ii",
            "image/jpeg",
            with_jpeg_exif(&original, &tiff(false)),
            30,
        ),
        (
            "jpeg-mm",
            "image/jpeg",
            with_jpeg_exif(&original, &tiff(true)),
            30,
        ),
        ("png-ii", "image/png", with_png_exif(&tiff(false)), 59),
        ("png-mm", "image/png", with_png_exif(&tiff(true)), 59),
        ("png-trailing-ii", "image/png", trailing_png_ii, 59),
        ("png-trailing-mm", "image/png", trailing_png_mm, 59),
    ];
    for (id, mime, bytes, value_offset) in fixtures {
        assert_eq!(orientation(&bytes), Some(6), "fixture {id}");
        for stored_display in [false, true] {
            let id = format!("{id}-{stored_display}");
            let photo = store
                .import_photo_bytes(&session, &bytes, &id, &id)
                .unwrap();
            assert_eq!(photo.transform, "rot90");
            store.close(&session).unwrap();
            let conn = Connection::open(&path).unwrap();
            let mut served = bytes.clone();
            if stored_display {
                // Distinct unused SHORT padding proves the stored variant wins
                // over fallback; neutralization must preserve this extra byte.
                served[value_offset + 2] = 0x5a;
                if mime == "image/png" {
                    let crc = crc32(&served[37..67]);
                    served[67..71].copy_from_slice(&crc.to_be_bytes());
                }
                conn.execute("INSERT INTO photos SELECT id,'display',mime,width,height,?2,created_at FROM photos WHERE id=?1", params![id, served]).unwrap();
            }
            let before = rows(&conn);
            drop(conn);
            session = store.open(&path).unwrap().session;
            let display = store.photo_protocol(&format!("/photo/{session}/{id}?v=display"));
            assert_eq!(display.status, 200);
            assert_eq!(display.mime.as_deref(), Some(mime));
            assert_eq!(display.bytes.len(), served.len());
            assert_eq!(orientation(&display.bytes), Some(1), "{id}");
            let mut expected = served;
            let value = if id.contains("-mm-") { [0, 1] } else { [1, 0] };
            expected[value_offset..value_offset + 2].copy_from_slice(&value);
            if mime == "image/png" {
                let crc = crc32(&expected[37..67]);
                expected[67..71].copy_from_slice(&crc.to_be_bytes());
            }
            assert_eq!(
                display.bytes, expected,
                "only Orientation and PNG CRC may change"
            );
            image::load_from_memory(&display.bytes).unwrap(); // Includes PNG CRC validation.
            let response = store.photo_protocol(&format!("/photo/{session}/{id}?v=original"));
            assert_eq!(response.status, 200);
            assert_eq!(response.bytes, bytes);
            store.close(&session).unwrap();
            assert_eq!(rows(&Connection::open(&path).unwrap()), before);
            session = store.open(&path).unwrap().session;
        }
    }
    store.close(&session).unwrap();

    // Malformed metadata/container bytes can exist in an older file; the serving
    // boundary must preserve them, without turning a successful read into 404.
    let mut malformed = Vec::new();
    for (index, value) in [(2, 0), (4, 255), (12, 4), (14, 2), (18, 42)] {
        let mut bad = tiff(false);
        bad[index] = value;
        malformed.push(("image/jpeg", with_jpeg_exif(&original, &bad)));
        malformed.push(("image/png", with_png_exif(&bad)));
    }
    let mut truncated = with_jpeg_exif(&original, &tiff(false));
    truncated.truncate(40);
    malformed.push(("image/jpeg", truncated));
    let mut truncated = with_png_exif(&tiff(false));
    truncated.truncate(truncated.len() - 5);
    malformed.push(("image/png", truncated));
    let mut overflow = with_png_exif(&tiff(false));
    overflow[33..37].copy_from_slice(&u32::MAX.to_be_bytes());
    malformed.push(("image/png", overflow));
    let mut bad_crc = with_png_exif(&tiff(false));
    bad_crc[67] ^= 1;
    malformed.push(("image/png", bad_crc));
    malformed.push(("image/jpeg", original));
    for (index, (mime, bytes)) in malformed.into_iter().enumerate() {
        let id = format!("malformed-{index}");
        let conn = Connection::open(&path).unwrap();
        for variant in ["original", "display"] {
            conn.execute("INSERT INTO photos(id,variant,mime,width,height,bytes,created_at) VALUES(?1,?2,?3,9,6,?4,'test')", params![id, variant, mime, bytes]).unwrap();
        }
        let before = rows(&conn);
        drop(conn);
        let session = store.open(&path).unwrap().session;
        for variant in ["display", "original"] {
            let response = store.photo_protocol(&format!("/photo/{session}/{id}?v={variant}"));
            assert_eq!(response.status, 200);
            assert_eq!(response.bytes, bytes, "{id}/{variant}");
        }
        store.close(&session).unwrap();
        assert_eq!(rows(&Connection::open(&path).unwrap()), before);
    }
}

#[test]
fn large_display_variant_has_no_orientation() {
    let dir = tempdir();
    let path = dir.path().join("large.pcbk");
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
    let session = store
        .create(&path, "project", r#"{"format_version":1,"rev":0}"#)
        .unwrap()
        .session;
    let original = with_jpeg_exif(&jpeg(4001, 3000), &tiff(false));
    let photo = store
        .import_photo_bytes(&session, &original, "large", "Suur")
        .unwrap();
    assert_eq!(photo.transform, "rot90");
    store.close(&session).unwrap();
    let conn = Connection::open(&path).unwrap();
    let before = rows(&conn);
    drop(conn);
    let session = store.open(&path).unwrap().session;
    assert_eq!(before.len(), 2);
    let display = store.photo_protocol(&format!("/photo/{session}/large?v=display"));
    assert_eq!(display.status, 200);
    assert_eq!(orientation(&display.bytes), None);
    assert!(!display.bytes.windows(6).any(|window| window == b"Exif\0\0"));
    let decoded = image::load_from_memory(&display.bytes).unwrap();
    assert!(u64::from(decoded.width()) * u64::from(decoded.height()) <= 12_000_000);
    assert_eq!(
        store
            .photo_protocol(&format!("/photo/{session}/large?v=original"))
            .bytes,
        original
    );
    store.close(&session).unwrap();
    assert_eq!(rows(&Connection::open(path).unwrap()), before);
}
