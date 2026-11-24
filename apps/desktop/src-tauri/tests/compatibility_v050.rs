#[path = "support/old_files.rs"]
mod old_files;

use old_files::{photo_rows, pin_uids, read_db, stored_file_id};
use pcbk_desktop::storage::{ProjectStore, SystemClock};
use serde_json::Value;
use std::{fs, path::Path, sync::Arc};

#[test]
fn v0_5_0_file_opens_and_keeps_data() {
    let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/v0.5.0.pcbk");
    let original = fs::read(&source)
        .unwrap_or_else(|error| panic!("release fixture {} must exist: {error}", source.display()));
    let root = tempfile::Builder::new()
        .prefix("bb-v0-5-0-")
        .tempdir()
        .unwrap();
    let copy = root.path().join("v0.5.0.pcbk");
    fs::copy(&source, &copy).unwrap();

    let db = read_db(&copy);
    let file_id = stored_file_id(&db).expect("v0.5.0 stores the file identity on creation");
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
    assert_eq!(app_version, "0.5.0");
    let doc_json: String = db
        .query_row("SELECT json FROM document WHERE id=1", [], |row| row.get(0))
        .unwrap();
    let doc: Value = serde_json::from_str(&doc_json).unwrap();
    assert_eq!(doc["scale"]["calibrated"], true);
    assert_eq!(doc["scale"]["calib"]["mm"], 76);
    assert!(doc["scale"]["pxPerMm"].as_f64().unwrap() > 0.0);

    let components = doc["components"].as_array().unwrap();
    assert_eq!(components.len(), 2);
    let u1 = components.iter().find(|part| part["ref"] == "U1").unwrap();
    let r1 = components.iter().find(|part| part["ref"] == "R1").unwrap();
    assert_eq!(u1["board"]["footprint"], "soic");
    assert_eq!(u1["board"]["params"]["pins"], 8);
    assert!(r1["board"].is_object());

    let junctions = doc["junctions"].as_array().unwrap();
    assert_eq!(junctions.len(), 1);
    let junction = &junctions[0];
    assert!(junction["board"]["at"]["x"].is_number());
    assert!(junction["board"]["at"]["y"].is_number());
    let connections = doc["connections"].as_array().unwrap();
    let (traces, air_lines): (Vec<_>, Vec<_>) = connections
        .iter()
        .partition(|connection| connection["board"].is_object());
    assert_eq!(traces.len(), 3);
    assert!(traces.iter().all(|trace| trace["board"]["kind"] == "trace"));
    assert!(traces.iter().any(|trace| {
        trace["board"]["waypoints"]
            .as_array()
            .is_some_and(|points| !points.is_empty())
    }));
    assert!(traces.iter().all(|trace| {
        trace["a"]["junction"] == junction["id"] || trace["b"]["junction"] == junction["id"]
    }));
    assert_eq!(air_lines.len(), 1);
    let air_line = air_lines[0];
    assert_eq!(air_line["basis"], "assumed");
    assert!(air_line["a"]["pin"].is_object() && air_line["b"]["pin"].is_object());

    let label = doc["netLabels"]
        .as_array()
        .unwrap()
        .iter()
        .find(|label| label["name"] == "Võrdlusvõrk")
        .expect("named network");
    let role_id = label["roleId"].as_str().expect("network role");
    assert!(doc["roles"]
        .as_array()
        .unwrap()
        .iter()
        .any(|role| role["id"] == role_id && role["label"] == "GND"));

    let measurements = doc["measurements"].as_array().unwrap();
    assert_eq!(measurements.len(), 1);
    let reading = &measurements[0];
    assert_eq!(reading["mode"], "voltage");
    assert_eq!(reading["value"], 4.98);
    assert_eq!(reading["at"]["c"], u1["id"]);
    assert_eq!(reading["at"]["p"], "3");
    let pins = pin_uids(&doc);
    assert!(pins.iter().any(|&(component, pin, uid)| {
        reading["at"]["c"] == component && reading["at"]["p"] == pin && reading["at"]["uid"] == uid
    }));

    let photos = doc["photos"].as_array().unwrap();
    assert_eq!(photos.len(), 1);
    assert_eq!(photos[0]["widthPx"], 800);
    assert_eq!(photos[0]["heightPx"], 600);
    let photo_id = photos[0]["id"].as_str().unwrap();
    let blobs = photo_rows(&db);
    let original_photo = blobs
        .iter()
        .find(|(id, variant, _)| id == photo_id && variant == "original")
        .expect("stored original photo");
    assert!(!original_photo.2.is_empty());
    drop(db);

    let store = ProjectStore::new(root.path().join("app-data"), Arc::new(SystemClock));
    for _ in 0..2 {
        let opened = store.open(&copy).unwrap();
        assert!(!opened.read_only);
        assert_eq!(opened.file_id, file_id);
        assert_eq!(opened.doc_json, doc_json);
        let response =
            store.photo_protocol(&format!("/photo/{}/{photo_id}?v=original", opened.session));
        assert_eq!(response.status, 200);
        assert_eq!(response.bytes, original_photo.2);
        store.close(&opened.session).unwrap();
    }

    let db = read_db(&copy);
    assert_eq!(stored_file_id(&db), Some(file_id));
    assert_eq!(photo_rows(&db), blobs);
    assert_eq!(fs::read(&source).unwrap(), original);
}
