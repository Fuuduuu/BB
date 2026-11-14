use pcbk_desktop::storage::{ProjectStore, SystemClock};
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde_json::Value;
use std::{fs, path::Path, sync::Arc};

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
    let trials = std::env::temp_dir().join("bb-m1-2-katse");
    fs::create_dir_all(&trials).unwrap();

    for version in ["v0.1.0", "v0.1.1"] {
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
        assert_eq!(stored_file_id(&db), None, "{version} predates file_id");
        let original_doc: String = db
            .query_row("SELECT json FROM document WHERE id=1", [], |row| row.get(0))
            .unwrap();
        let original_value: Value = serde_json::from_str(&original_doc).unwrap();
        assert_eq!(original_value["photos"].as_array().unwrap().len(), 0);
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
        store.close(&viewed.session).unwrap();
        assert_eq!(fs::read(&copy).unwrap(), original);
        assert_eq!(stored_file_id(&read_db(&copy)), None);
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
        assert_eq!(photo_count, 0);
        drop(db);

        let reopened = store.open(&copy).unwrap();
        assert_eq!(reopened.file_id, opened.file_id);
        assert_eq!(reopened.doc_json, original_doc);
        store.close(&reopened.session).unwrap();
        assert_eq!(fs::read(&source).unwrap(), original);
    }
}
