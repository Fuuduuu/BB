mod common;

use common::Fixture;
use serde_json::Value;
use std::{fs, path::Path};

#[test]
fn every_release_pcbk_opens_without_modifying_source() {
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut files: Vec<_> = fs::read_dir(&directory)
        .expect("release fixture directory must exist")
        .map(|entry| entry.unwrap().path())
        .filter(|path| {
            path.is_file()
                && path.file_name().unwrap().to_str().unwrap().starts_with('v')
                && path
                    .extension()
                    .is_some_and(|extension| extension == "pcbk")
        })
        .collect();
    files.sort();
    assert!(
        !files.is_empty(),
        "at least one release .pcbk fixture is required"
    );

    for source in files {
        let before = fs::read(&source).unwrap();
        let fixture = Fixture::new();
        let copy = fixture.path(source.file_name().unwrap().to_str().unwrap());
        fs::copy(&source, &copy).unwrap();

        let opened = fixture.store.open(&copy).unwrap_or_else(|error| {
            panic!("release fixture {} must open: {error:?}", source.display())
        });
        let doc: Value = serde_json::from_str(&opened.doc_json).unwrap();
        let components = doc["components"].as_array().unwrap();
        assert!(components.iter().any(|component| component["ref"] == "R1"));
        assert!(components.iter().any(|component| component["ref"] == "U1"));
        fixture.store.close(&opened.session).unwrap();

        assert_eq!(
            fs::read(&source).unwrap(),
            before,
            "release fixture {} must remain byte-for-byte unchanged",
            source.display()
        );
    }
}
