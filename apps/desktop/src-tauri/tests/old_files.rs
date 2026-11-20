#[path = "support/old_files.rs"]
mod old_files;

use old_files::{photo_rows, pin_uids, read_db, stored_file_id};
use pcbk_desktop::storage::{ProjectStore, SystemClock};
use serde_json::Value;
use std::{fs, path::Path, sync::Arc};

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

#[test]
fn v0_4_0_file_opens_and_keeps_data() {
    let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/v0.4.0.pcbk");
    let original = fs::read(&source)
        .unwrap_or_else(|error| panic!("release fixture {} must exist: {error}", source.display()));
    let root = tempfile::Builder::new()
        .prefix("bb-v0-4-0-")
        .tempdir()
        .unwrap();
    let copy = root.path().join("v0.4.0.pcbk");
    fs::copy(&source, &copy).unwrap();

    let db = read_db(&copy);
    let file_id = stored_file_id(&db).expect("v0.4.0 stores file_id on creation");
    assert_eq!(
        uuid::Uuid::parse_str(&file_id).unwrap().get_version_num(),
        4
    );
    let app_version: String = db
        .query_row(
            "SELECT value FROM meta WHERE key='app_version'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(app_version, "0.4.0");
    let doc_json: String = db
        .query_row("SELECT json FROM document WHERE id=1", [], |row| row.get(0))
        .unwrap();
    let doc: Value = serde_json::from_str(&doc_json).unwrap();
    assert_eq!(doc["scale"]["calibrated"], true);
    assert_eq!(doc["scale"]["calib"]["mm"], 20);
    assert!(doc["scale"]["pxPerMm"].as_f64().unwrap() > 0.0);

    let components = doc["components"].as_array().unwrap();
    assert_eq!(components.len(), 2);
    let r1 = components.iter().find(|c| c["ref"] == "R1").unwrap();
    let u1 = components.iter().find(|c| c["ref"] == "U1").unwrap();
    assert!(r1["board"].is_object());
    assert_eq!(u1["board"]["footprint"], "soic");
    assert_eq!(u1["board"]["params"]["pins"], 8);
    let label = &u1["board"]["labelOffset"];
    assert!(label["x"].as_f64().unwrap().abs() + label["y"].as_f64().unwrap().abs() > 0.0);
    let u1_pins = u1["pins"].as_array().unwrap();
    let vcc = u1_pins.iter().find(|pin| pin["id"] == "8").unwrap();
    let nc = u1_pins.iter().find(|pin| pin["id"] == "7").unwrap();
    assert_eq!(vcc["name"], "VCC");
    assert_eq!(nc["nc"], true);

    let measurements = doc["measurements"].as_array().unwrap();
    assert_eq!(measurements.len(), 1);
    let reading = &measurements[0];
    assert_eq!(reading["mode"], "voltage");
    assert_eq!(reading["value"], 4.98);
    assert_eq!(reading["at"]["c"], u1["id"]);
    assert_eq!(reading["at"]["p"], vcc["id"]);
    assert_eq!(reading["at"]["uid"], vcc["uid"]);
    assert_eq!(reading["ref"]["c"], r1["id"]);
    assert_eq!(reading["ref"]["p"], "1");

    let photos = doc["photos"].as_array().unwrap();
    assert_eq!(photos.len(), 1);
    let photo_id = photos[0]["id"].as_str().unwrap();
    let blobs = photo_rows(&db);
    assert_eq!(blobs.len(), 1);
    assert_eq!(blobs[0].0, photo_id);
    assert_eq!(blobs[0].1, "original");
    assert!(!blobs[0].2.is_empty());
    drop(db);

    let store = ProjectStore::new(root.path().join("app-data"), Arc::new(SystemClock));
    for _ in 0..2 {
        let opened = store.open(&copy).unwrap();
        assert_eq!(opened.file_id, file_id);
        assert_eq!(opened.doc_json, doc_json);
        let response =
            store.photo_protocol(&format!("/photo/{}/{photo_id}?v=original", opened.session));
        assert_eq!(response.status, 200);
        assert_eq!(response.bytes, blobs[0].2);
        store.close(&opened.session).unwrap();
    }
    let db = read_db(&copy);
    assert_eq!(stored_file_id(&db), Some(file_id));
    assert_eq!(photo_rows(&db), blobs);
    assert_eq!(fs::read(&source).unwrap(), original);
}
