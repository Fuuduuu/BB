mod common;

use common::{doc, meta, name, read_db, Fixture, PROJECT_ID};
use pcbk_desktop::storage::{BackupKind, CopyRequest, OpenedProjectDto};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::{fs, path::Path};

fn file_id(opened: &OpenedProjectDto) -> String {
    let dto = serde_json::to_value(opened).unwrap();
    let id = dto["file_id"]
        .as_str()
        .expect("opened DTO must expose file_id");
    assert_eq!(uuid::Uuid::parse_str(id).unwrap().get_version_num(), 4);
    id.to_owned()
}

fn legacy(f: &Fixture, name: &str) {
    let opened = f.create(name);
    f.store.close(&opened.session).unwrap();
    Connection::open(f.path(name))
        .unwrap()
        .execute("DELETE FROM meta WHERE key='file_id'", [])
        .unwrap();
}

#[test]
fn old_file_gets_file_id_on_first_writable_open() {
    let f = Fixture::new();
    legacy(&f, "old.pcbk");
    let opened = f.store.open(&f.path("old.pcbk")).unwrap();
    let id = file_id(&opened);
    f.store.close(&opened.session).unwrap();
    assert_eq!(meta(&read_db(f.path("old.pcbk")), "file_id"), id);
    let reopened = f.store.open(&f.path("old.pcbk")).unwrap();
    assert_eq!(file_id(&reopened), id);
}

#[test]
fn read_only_open_writes_nothing() {
    let f = Fixture::new();
    legacy(&f, "old.pcbk");
    let path = f.path("old.pcbk");
    let before = fs::read(&path).unwrap();
    let permissions = fs::metadata(&path).unwrap().permissions();
    let mut readonly = permissions.clone();
    readonly.set_readonly(true);
    fs::set_permissions(&path, readonly).unwrap();
    let opened = f.store.open(&path).unwrap();
    assert!(opened.read_only);
    file_id(&opened);
    assert!(f.store.backups(PROJECT_ID).unwrap().is_empty());
    assert!(f.store.backup_full(&opened.session).is_err());
    f.store.close(&opened.session).unwrap();
    assert_eq!(fs::read(&path).unwrap(), before);
    fs::set_permissions(&path, permissions).unwrap();
}

#[test]
fn copy_and_restore_get_new_file_id() {
    let f = Fixture::new();
    let original = f.open_with_daily_backup("original.pcbk");
    let original_id = file_id(&original);
    let mut ids = vec![original_id];
    for (filename, project_id) in [("same.pcbk", PROJECT_ID), ("new.pcbk", "new-project")] {
        let copied = f
            .store
            .copy(CopyRequest {
                session: &original.session,
                dest: &f.path(filename),
                project_id,
                copied_from_project_id: (project_id != PROJECT_ID).then_some(PROJECT_ID),
                doc_json: &doc(0),
                rev: 0,
                view_json: None,
                journal: &[],
            })
            .unwrap();
        assert!(!copied.from_memory);
        assert_eq!(copied.opened.project_id, project_id);
        let id = file_id(&copied.opened);
        assert!(!ids.contains(&id));
        ids.push(id.clone());
        f.store.close(&copied.opened.session).unwrap();
        assert_eq!(meta(&read_db(f.path(filename)), "file_id"), id);
    }
    let full = f.backups(BackupKind::Full).remove(0);
    let restored = f
        .store
        .restore(Path::new(&full.file), &f.path("restored.pcbk"))
        .unwrap();
    assert_eq!(restored.project_id, PROJECT_ID);
    assert!(!ids.contains(&file_id(&restored)));
}

#[test]
fn restored_and_original_file_keep_separate_backups() {
    let f = Fixture::new();
    let original = f.open_with_daily_backup("original.pcbk");
    let full = f.backups(BackupKind::Full).remove(0);
    let restored = f
        .store
        .restore(Path::new(&full.file), &f.path("restored.pcbk"))
        .unwrap();
    f.store.backup_full(&restored.session).unwrap();
    let original_id = file_id(&original);
    let restored_id = file_id(&restored);
    assert_ne!(original_id, restored_id);
    let original_bytes = fs::read(&full.file).unwrap();
    for day in 10..=16 {
        f.clock.set(&format!("2026-11-{day}T10:00:00+02:00"));
        f.store.backup_full(&restored.session).unwrap();
    }
    let all = f.backups(BackupKind::Full);
    let grouped = |id: &str| {
        all.iter()
            .filter(|b| serde_json::to_value(b).unwrap()["file_id"] == id)
            .count()
    };
    assert_eq!(grouped(&original_id), 1);
    assert_eq!(grouped(&restored_id), 5);
    assert_eq!(fs::read(&full.file).unwrap(), original_bytes);
    for backup in all {
        let id = serde_json::to_value(&backup).unwrap()["file_id"]
            .as_str()
            .unwrap()
            .to_owned();
        assert_eq!(
            Path::new(&backup.file)
                .parent()
                .unwrap()
                .file_name()
                .unwrap(),
            id.as_str()
        );
    }
}

#[test]
fn doc_backup_restores_only_onto_its_own_file() {
    let f = Fixture::new();
    let original = f.open_with_daily_backup("original.pcbk");
    let original_id = file_id(&original);
    let full = f.backups(BackupKind::Full).remove(0);
    let other = f
        .store
        .restore(Path::new(&full.file), &f.path("other.pcbk"))
        .unwrap();
    f.store.backup_full(&other.session).unwrap();
    f.clock.set("2026-11-09T10:30:00+02:00");
    f.save(&original, 1);
    let snapshot = f.backups(BackupKind::Doc).remove(0);
    assert_eq!(
        serde_json::to_value(&snapshot).unwrap()["file_id"],
        original_id
    );
    assert_eq!(snapshot.base.as_deref(), Some(name(&full.file)));
    let restored = f
        .store
        .restore(Path::new(&snapshot.file), &f.path("good.pcbk"))
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&restored.doc_json).unwrap()["rev"],
        1
    );

    // A different file's valid full backup cannot be used across the group boundary.
    let other_id = file_id(&other);
    let mut corrupt: Value = serde_json::from_slice(&fs::read(&snapshot.file).unwrap()).unwrap();
    corrupt["base"] = json!(format!("../{other_id}/{}", name(&full.file)));
    fs::write(&snapshot.file, serde_json::to_vec(&corrupt).unwrap()).unwrap();
    let rejected = f.path("rejected.pcbk");
    assert!(f
        .store
        .restore(Path::new(&snapshot.file), &rejected)
        .is_err());
    assert!(!rejected.exists());
    // A same-name base in a sibling group also cannot rescue a missing local base.
    corrupt["base"] = json!(name(&full.file));
    fs::write(&snapshot.file, serde_json::to_vec(&corrupt).unwrap()).unwrap();
    fs::remove_file(&full.file).unwrap();
    assert!(f
        .store
        .restore(Path::new(&snapshot.file), &rejected)
        .is_err());
    assert!(!f
        .backups(BackupKind::Doc)
        .iter()
        .any(|b| b.file == snapshot.file));
}

#[test]
fn legacy_backup_folder_stays_listed_and_untouched() {
    let f = Fixture::new();
    let created = f.create("legacy-source.pcbk");
    f.store.close(&created.session).unwrap();
    let dir = f.app_data.join("backups").join(PROJECT_ID);
    fs::create_dir_all(&dir).unwrap();
    let mut legacy_files = Vec::new();
    for day in 1..=7 {
        let file = dir.join(format!("2026-11-{day:02}-100000-v1.pcbk"));
        fs::copy(f.path("legacy-source.pcbk"), &file).unwrap();
        legacy_files.push((file.clone(), fs::read(file).unwrap()));
    }
    let old_doc = dir.join("20261107-103000.doc.json");
    let bytes = serde_json::to_vec(&json!({"base":"2026-11-07-100000-v1.pcbk","rev":1,"doc":serde_json::from_str::<Value>(&doc(1)).unwrap(),"view":null})).unwrap();
    fs::write(&old_doc, &bytes).unwrap();
    legacy_files.push((old_doc.clone(), bytes));
    let opened = f.store.open(&f.path("legacy-source.pcbk")).unwrap();
    for _ in 0..7 {
        f.store.backup_full(&opened.session).unwrap();
    }
    let all = f.store.backups(PROJECT_ID).unwrap();
    for (file, before) in legacy_files {
        assert_eq!(fs::read(&file).unwrap(), before);
        // The inventory canonicalizes paths, including Windows short-name aliases.
        let canonical_file = dunce::canonicalize(&file).unwrap();
        let listed = all
            .iter()
            .find(|b| Path::new(&b.file) == canonical_file)
            .unwrap();
        assert!(serde_json::to_value(listed).unwrap()["file_id"].is_null());
    }
    assert_eq!(all.len(), 13); // Eight legacy entries, five retained modern full copies.
    let restored = f
        .store
        .restore(&old_doc, &f.path("legacy-restored.pcbk"))
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&restored.doc_json).unwrap()["rev"],
        1
    );
}
