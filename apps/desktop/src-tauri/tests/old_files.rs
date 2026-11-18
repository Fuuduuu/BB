use pcbk_desktop::storage::{ProjectStore, SystemClock};
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde_json::Value;
use std::{collections::HashSet, fs, io::Cursor, path::Path, sync::Arc};

fn read_db(path: &Path) -> Connection {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap()
}

fn stored_file_id(db: &Connection) -> Option<String> {
    db.query_row("SELECT value FROM meta WHERE key='file_id'", [], |row| {
        row.get(0)
    })
    .optional()
    .unwrap()
}

fn pin_uids(doc: &Value) -> Vec<(&str, &str, &str)> {
    doc["components"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|component| {
            component["pins"].as_array().unwrap().iter().map(|pin| {
                (
                    component["id"].as_str().unwrap(),
                    pin["id"].as_str().unwrap(),
                    pin["uid"].as_str().unwrap(),
                )
            })
        })
        .collect()
}

#[test]
fn old_files_open_and_get_file_id_on_first_writable_open() {
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let trials = std::env::temp_dir().join("bb-m1-3-katse");
    fs::create_dir_all(&trials).unwrap();

    for version in ["v0.1.0", "v0.1.1", "v0.2.0", "v0.3.0"] {
        let source = directory.join(format!("{version}.pcbk"));
        let original = fs::read(&source).unwrap_or_else(|error| {
            panic!("release fixture {} must exist: {error}", source.display())
        });
        let root = tempfile::Builder::new()
            .prefix("old-files-")
            .tempdir_in(&trials)
            .unwrap();
        let copy = root.path().join(format!("{version}.pcbk"));
        fs::copy(&source, &copy).unwrap();
        let db = read_db(&copy);
        let original_file_id = stored_file_id(&db);
        let has_identity = matches!(version, "v0.2.0" | "v0.3.0");
        if has_identity {
            assert_eq!(
                uuid::Uuid::parse_str(original_file_id.as_deref().unwrap())
                    .unwrap()
                    .get_version_num(),
                4,
                "{version} already stores file_id"
            );
        } else {
            assert_eq!(original_file_id, None, "{version} predates file_id");
        }
        let original_doc: String = db
            .query_row("SELECT json FROM document WHERE id=1", [], |row| row.get(0))
            .unwrap();
        let original_value: Value = serde_json::from_str(&original_doc).unwrap();
        let expected_photos = usize::from(has_identity);
        assert_eq!(
            original_value["photos"].as_array().unwrap().len(),
            expected_photos
        );
        let original_pins = pin_uids(&original_value);
        assert_eq!(original_pins.len(), 10, "R1 and U1 must have their pins");
        assert!(original_pins.iter().all(|(_, _, uid)| !uid.is_empty()));
        drop(db);

        let store = ProjectStore::new(root.path().join("app-data"), Arc::new(SystemClock));
        let permissions = fs::metadata(&copy).unwrap().permissions();
        let mut readonly = permissions.clone();
        readonly.set_readonly(true);
        fs::set_permissions(&copy, readonly).unwrap();
        let viewed = store.open(&copy).unwrap();
        assert!(viewed.read_only);
        assert_eq!(viewed.doc_json, original_doc);
        if let Some(id) = &original_file_id {
            assert_eq!(&viewed.file_id, id);
        }
        store.close(&viewed.session).unwrap();
        assert_eq!(fs::read(&copy).unwrap(), original);
        assert_eq!(stored_file_id(&read_db(&copy)), original_file_id);
        fs::set_permissions(&copy, permissions).unwrap();

        let opened = store.open(&copy).unwrap();
        assert!(!opened.read_only);
        assert_eq!(
            uuid::Uuid::parse_str(&opened.file_id)
                .unwrap()
                .get_version_num(),
            4
        );
        assert_eq!(opened.doc_json, original_doc);
        if let Some(id) = &original_file_id {
            assert_eq!(&opened.file_id, id, "opening preserves existing identity");
        }
        let opened_value: Value = serde_json::from_str(&opened.doc_json).unwrap();
        assert_eq!(pin_uids(&opened_value), original_pins);
        store.close(&opened.session).unwrap();

        let db = read_db(&copy);
        assert_eq!(
            stored_file_id(&db).as_deref(),
            Some(opened.file_id.as_str())
        );
        let stored_doc: String = db
            .query_row("SELECT json FROM document WHERE id=1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(stored_doc, original_doc);
        let photo_count: i64 = db
            .query_row("SELECT COUNT(*) FROM photos", [], |row| row.get(0))
            .expect("old files must have an accessible photos table after opening");
        assert_eq!(photo_count, expected_photos as i64);
        drop(db);

        let reopened = store.open(&copy).unwrap();
        assert_eq!(reopened.file_id, opened.file_id);
        assert_eq!(reopened.doc_json, original_doc);
        store.close(&reopened.session).unwrap();
        assert_eq!(fs::read(&source).unwrap(), original);
    }
}

fn orientation(bytes: &[u8]) -> Option<u32> {
    let exif = exif::Reader::new()
        .read_from_container(&mut Cursor::new(bytes))
        .ok()?;
    exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)?
        .value
        .get_uint(0)
}

fn photo_rows(db: &Connection) -> Vec<(String, String, Vec<u8>)> {
    db.prepare("SELECT id,variant,bytes FROM photos ORDER BY id,variant")
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}

#[test]
fn v0_2_0_photo_scale_and_measurement_survive_open() {
    let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/v0.2.0.pcbk");
    let original = fs::read(&source)
        .unwrap_or_else(|error| panic!("release fixture {} must exist: {error}", source.display()));
    let trials = std::env::temp_dir().join("bb-m1-3-katse");
    fs::create_dir_all(&trials).unwrap();
    let root = tempfile::Builder::new()
        .prefix("v0-2-0-")
        .tempdir_in(&trials)
        .unwrap();
    let copy = root.path().join("v0.2.0.pcbk");
    fs::copy(&source, &copy).unwrap();

    let db = read_db(&copy);
    let original_file_id = stored_file_id(&db).expect("v0.2.0 stores file_id on creation");
    assert_eq!(
        uuid::Uuid::parse_str(&original_file_id)
            .unwrap()
            .get_version_num(),
        4
    );
    let original_doc: String = db
        .query_row("SELECT json FROM document WHERE id=1", [], |row| row.get(0))
        .unwrap();
    let original_view: String = db
        .query_row("SELECT json FROM view WHERE id=1", [], |row| row.get(0))
        .unwrap();
    let doc: Value = serde_json::from_str(&original_doc).unwrap();
    let view: Value = serde_json::from_str(&original_view).unwrap();
    assert_eq!(view["navigatorOpen"], false);
    assert_eq!(doc["scale"]["calibrated"], true);
    let px_per_mm = doc["scale"]["pxPerMm"].as_f64().unwrap();
    assert!(
        (px_per_mm - 73.8905527054134).abs() < 1e-10,
        "fixture was calibrated to 10 mm across 738.905527054134 px"
    );

    let photos = doc["photos"].as_array().unwrap();
    assert_eq!(photos.len(), 1);
    let photo = &photos[0];
    let photo_id = photo["id"].as_str().filter(|id| !id.is_empty()).unwrap();
    assert_eq!(photo["transform"], "rot90");
    assert_eq!(photo["widthPx"], 4000);
    assert_eq!(photo["heightPx"], 3000);
    let original_photos = photo_rows(&db);
    assert_eq!(original_photos.len(), 1, "12 MP needs only the original");
    assert_eq!(original_photos[0].0, photo_id);
    assert_eq!(original_photos[0].1, "original");
    let original_blob = &original_photos[0].2;
    assert_eq!(orientation(original_blob), Some(6));
    assert_eq!(
        image::ImageReader::new(Cursor::new(original_blob))
            .with_guessed_format()
            .unwrap()
            .into_dimensions()
            .unwrap(),
        (4000, 3000)
    );

    let components = doc["components"].as_array().unwrap();
    assert_eq!(components.len(), 2);
    let resistor = components.iter().find(|c| c["ref"] == "R1").unwrap();
    assert_eq!(resistor["kind"], "resistor");
    assert_eq!(resistor["pins"].as_array().unwrap().len(), 2);
    assert!(resistor["board"].is_object(), "R1 must be placed");
    let chip = components.iter().find(|c| c["ref"] == "U1").unwrap();
    assert_eq!(chip["board"]["footprint"], "soic");
    assert_eq!(chip["board"]["params"]["pins"], 8);
    let chip_pins = chip["pins"].as_array().unwrap();
    assert_eq!(chip_pins.len(), 8);
    let feedback = chip_pins.iter().find(|pin| pin["id"] == "3").unwrap();
    assert_eq!(feedback["name"], "FB");
    let nc = chip_pins.iter().find(|pin| pin["id"] == "8").unwrap();
    assert_eq!(nc["nc"], true);
    let original_pins = pin_uids(&doc);
    assert_eq!(original_pins.len(), 10);
    assert!(original_pins
        .iter()
        .all(|(component, pin, uid)| !component.is_empty() && !pin.is_empty() && !uid.is_empty()));
    assert_eq!(
        original_pins
            .iter()
            .map(|(_, _, uid)| uid)
            .collect::<HashSet<_>>()
            .len(),
        original_pins.len()
    );

    let measurements = doc["measurements"].as_array().unwrap();
    assert_eq!(measurements.len(), 1);
    let measurement = &measurements[0];
    assert!(measurement["id"].as_str().is_some_and(|id| !id.is_empty()));
    assert_eq!(measurement["mode"], "voltage");
    assert_eq!(measurement["value"], 4.98);
    assert_eq!(measurement["at"]["c"], chip["id"]);
    assert_eq!(measurement["at"]["p"], "3");
    assert_eq!(measurement["at"]["uid"], feedback["uid"]);
    assert_eq!(measurement["atLabel"], "U1.3");
    assert!(measurement.get("staleByRepairId").is_none());
    drop(db);

    let store = ProjectStore::new(root.path().join("app-data"), Arc::new(SystemClock));
    let permissions = fs::metadata(&copy).unwrap().permissions();
    let mut readonly = permissions.clone();
    readonly.set_readonly(true);
    fs::set_permissions(&copy, readonly).unwrap();
    let viewed = store.open(&copy).unwrap();
    assert!(viewed.read_only);
    assert_eq!(viewed.file_id, original_file_id);
    assert_eq!(viewed.doc_json, original_doc);
    assert_eq!(viewed.view_json.as_deref(), Some(original_view.as_str()));
    let response =
        store.photo_protocol(&format!("/photo/{}/{photo_id}?v=original", viewed.session));
    assert_eq!(response.status, 200);
    assert_eq!(&response.bytes, original_blob);
    store.close(&viewed.session).unwrap();
    assert_eq!(
        fs::read(&copy).unwrap(),
        original,
        "read-only open writes nothing"
    );
    assert_eq!(fs::read(&source).unwrap(), original);
    fs::set_permissions(&copy, permissions).unwrap();

    for _ in 0..2 {
        let opened = store.open(&copy).unwrap();
        assert!(!opened.read_only);
        assert_eq!(opened.file_id, original_file_id);
        assert_eq!(opened.doc_json, original_doc);
        assert_eq!(opened.view_json.as_deref(), Some(original_view.as_str()));
        let opened_doc: Value = serde_json::from_str(&opened.doc_json).unwrap();
        assert_eq!(pin_uids(&opened_doc), original_pins);
        assert_eq!(opened_doc["scale"], doc["scale"]);
        assert_eq!(opened_doc["measurements"], doc["measurements"]);

        let original_response =
            store.photo_protocol(&format!("/photo/{}/{photo_id}?v=original", opened.session));
        assert_eq!(original_response.status, 200);
        assert_eq!(original_response.mime.as_deref(), Some("image/jpeg"));
        assert_eq!(&original_response.bytes, original_blob);
        let display =
            store.photo_protocol(&format!("/photo/{}/{photo_id}?v=display", opened.session));
        assert_eq!(display.status, 200);
        assert_eq!(display.mime.as_deref(), Some("image/jpeg"));
        assert_eq!(display.bytes.len(), original_blob.len());
        assert_eq!(orientation(&display.bytes), Some(1));
        store.close(&opened.session).unwrap();

        let db = read_db(&copy);
        assert_eq!(
            stored_file_id(&db).as_deref(),
            Some(original_file_id.as_str())
        );
        assert_eq!(
            photo_rows(&db),
            original_photos,
            "protocol never edits blobs"
        );
        drop(db);
        assert_eq!(fs::read(&source).unwrap(), original);
    }
}

#[test]
fn v0_3_0_label_probes_and_scale_survive_open() {
    let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/v0.3.0.pcbk");
    let original = fs::read(&source)
        .unwrap_or_else(|error| panic!("release fixture {} must exist: {error}", source.display()));
    let root = tempfile::Builder::new()
        .prefix("bb-v0-3-0-")
        .tempdir()
        .unwrap();
    let copy = root.path().join("v0.3.0.pcbk");
    fs::copy(&source, &copy).unwrap();
    let db = read_db(&copy);
    let original_id = stored_file_id(&db).expect("v0.3.0 stores file_id on creation");
    let original_doc: String = db
        .query_row("SELECT json FROM document WHERE id=1", [], |row| row.get(0))
        .unwrap();
    let original_view: String = db
        .query_row("SELECT json FROM view WHERE id=1", [], |row| row.get(0))
        .unwrap();
    let doc: Value = serde_json::from_str(&original_doc).unwrap();
    let view: Value = serde_json::from_str(&original_view).unwrap();
    assert_eq!(view["navigatorOpen"], false);
    let zoom = view["boardView"]["zoom"].as_f64().unwrap();
    assert!(zoom.is_finite() && zoom > 0.0 && zoom != 1.0);
    assert_eq!(doc["scale"]["calibrated"], true);
    let scale = doc["scale"]["pxPerMm"].as_f64().unwrap();
    assert!((scale - 4.025256739675138).abs() < 1e-10);
    assert_eq!(doc["scale"]["calib"]["mm"], 20);

    let photos = doc["photos"].as_array().unwrap();
    assert_eq!(photos.len(), 1);
    let photo = &photos[0];
    assert_eq!(photo["transform"], "rot90");
    assert_eq!(photo["widthPx"], 4000);
    assert_eq!(photo["heightPx"], 3000);
    let photo_id = photo["id"].as_str().unwrap();
    let blobs = photo_rows(&db);
    assert_eq!(blobs.len(), 1);
    assert_eq!(blobs[0].0, photo_id);
    assert_eq!(blobs[0].1, "original");
    let bytes = &blobs[0].2;
    assert_eq!(orientation(bytes), Some(6));
    assert_eq!(bytes.len(), 162457);

    let components = doc["components"].as_array().unwrap();
    assert_eq!(components.len(), 2);
    let u1 = components.iter().find(|c| c["ref"] == "U1").unwrap();
    let r1 = components.iter().find(|c| c["ref"] == "R1").unwrap();
    assert_eq!(u1["board"]["footprint"], "soic");
    assert_eq!(u1["board"]["params"]["pins"], 8);
    let label = &u1["board"]["labelOffset"];
    assert!(label["x"].as_f64().unwrap().abs() + label["y"].as_f64().unwrap().abs() > 0.0);
    assert!(r1["board"].is_object());
    assert_eq!(r1["kind"], "resistor");
    let find_pin = |component: &Value, id: &str| {
        component["pins"]
            .as_array()
            .unwrap()
            .iter()
            .find(|pin| pin["id"] == id)
            .unwrap()
            .clone()
    };
    let red = find_pin(u1, "8");
    let black = find_pin(r1, "1");
    assert_eq!(red["name"], "VCC");
    assert_eq!(find_pin(u1, "7")["nc"], true);
    let uids = pin_uids(&doc);
    assert_eq!(uids.len(), 10);
    assert!(uids.iter().all(|(_, _, uid)| !uid.is_empty()));
    assert_eq!(
        uids.iter()
            .map(|(_, _, uid)| uid)
            .collect::<HashSet<_>>()
            .len(),
        10
    );
    let measurements = doc["measurements"].as_array().unwrap();
    assert_eq!(measurements.len(), 1);
    let m = &measurements[0];
    assert_eq!(m["mode"], "voltage");
    assert_eq!(m["value"], 4.98);
    assert_eq!(m["power"], "on");
    assert_eq!(m["at"]["c"], u1["id"]);
    assert_eq!(m["at"]["p"], red["id"]);
    assert_eq!(m["at"]["uid"], red["uid"]);
    assert_eq!(m["ref"]["c"], r1["id"]);
    assert_eq!(m["ref"]["p"], black["id"]);
    assert_eq!(m["ref"]["uid"], black["uid"]);
    drop(db);

    let store = ProjectStore::new(root.path().join("app-data"), Arc::new(SystemClock));
    let permissions = fs::metadata(&copy).unwrap().permissions();
    let mut readonly = permissions.clone();
    readonly.set_readonly(true);
    fs::set_permissions(&copy, readonly).unwrap();
    let viewed = store.open(&copy).unwrap();
    assert!(viewed.read_only);
    assert_eq!(viewed.file_id, original_id);
    assert_eq!(viewed.doc_json, original_doc);
    assert_eq!(viewed.view_json.as_deref(), Some(original_view.as_str()));
    let read_original = |session: &str| {
        let original = store.photo_protocol(&format!("/photo/{session}/{photo_id}?v=original"));
        assert_eq!(original.status, 200);
        assert_eq!(&original.bytes, bytes);
    };
    read_original(&viewed.session);
    store.close(&viewed.session).unwrap();
    assert_eq!(fs::read(&copy).unwrap(), original);
    fs::set_permissions(&copy, permissions).unwrap();

    let opened = store.open(&copy).unwrap();
    assert!(!opened.read_only);
    assert_eq!(
        uuid::Uuid::parse_str(&opened.file_id)
            .unwrap()
            .get_version_num(),
        4
    );
    assert_eq!(opened.file_id, original_id);
    assert_eq!(opened.doc_json, original_doc);
    assert_eq!(opened.view_json.as_deref(), Some(original_view.as_str()));
    read_original(&opened.session);
    store.close(&opened.session).unwrap();
    let db = read_db(&copy);
    assert_eq!(stored_file_id(&db), Some(original_id));
    assert_eq!(photo_rows(&db), blobs);
    assert_eq!(fs::read(&source).unwrap(), original);
}
