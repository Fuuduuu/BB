mod common;

use common::{
    copy_request as request, doc, journal, meta, name, read_db, rev, summaries, Fixture, PROJECT_ID,
};
use pcbk_desktop::storage::{replace_token, BackupKind, CopyRequest, Reason};
use rusqlite::Connection;
use std::{collections::BTreeSet, fs, path::Path};

#[test]
fn stale_tmp_from_crash_does_not_block_create_copy_restore() {
    let f = Fixture::new();
    let original = f.path("Algne plaat õ.pcbk");
    let create_tmp = f.path("Algne plaat õ.pcbk.tmp");
    fs::write(&create_tmp, b"interrupted create").unwrap();
    let initial = f.create("Algne plaat õ.pcbk");
    assert_eq!(fs::read(&create_tmp).unwrap(), b"interrupted create");
    f.store.close(&initial.session).unwrap();
    let db = Connection::open(&original).unwrap();
    db.execute("INSERT INTO thumbnail(id,png) VALUES (1, X'0102')", [])
        .unwrap();
    drop(db);
    let before = fs::read(&original).unwrap();
    let source = f.store.open(&original).unwrap();
    let dest = f.path("Koopia õ.pcbk");
    let copy_tmp = f.path("Koopia õ.pcbk.tmp");
    fs::write(&copy_tmp, b"interrupted copy").unwrap();

    let copied = f.store.copy(request(&source, &dest, &doc(1))).unwrap();
    assert!(!copied.from_memory);
    assert_ne!(source.session, copied.opened.session);
    assert_eq!(fs::read(&copy_tmp).unwrap(), b"interrupted copy");
    f.store.close(&copied.opened.session).unwrap();
    f.store.close(&source.session).unwrap();
    assert_eq!(fs::read(&original).unwrap(), before);
    let db = read_db(&dest);
    assert_eq!(rev(&db), 1);
    let thumbnail: Vec<u8> = db
        .query_row("SELECT png FROM thumbnail", [], |row| row.get(0))
        .unwrap();
    assert_eq!(thumbnail, [1, 2]);

    let backup = f.backups(BackupKind::Full).remove(0);
    let restored_path = f.path("Taaste õ.pcbk");
    let restore_tmp = f.path("Taaste õ.pcbk.tmp");
    fs::write(&restore_tmp, b"interrupted restore").unwrap();
    let restored = f
        .store
        .restore(Path::new(&backup.file), &restored_path)
        .unwrap();
    f.store.close(&restored.session).unwrap();
    assert_eq!(restored.doc_json, doc(0));
    assert_eq!(fs::read(&restore_tmp).unwrap(), b"interrupted restore");
}

#[test]
fn copy_new_identity_sets_copied_from() {
    let f = Fixture::new();
    let original = f.path("original.pcbk");
    let created = f.create("original.pcbk");
    f.store.close(&created.session).unwrap();
    let permissions = fs::metadata(&original).unwrap().permissions();
    let mut read_only = permissions.clone();
    read_only.set_readonly(true);
    fs::set_permissions(&original, read_only).unwrap();
    let source = f.store.open(&original).unwrap();
    assert!(source.read_only);
    assert!(f.backups(BackupKind::Full).is_empty());
    let dest = f.path("copy.pcbk");
    let copied = f
        .store
        .copy(CopyRequest {
            project_id: "project-copy",
            copied_from_project_id: Some(PROJECT_ID),
            ..request(&source, &dest, &doc(1))
        })
        .unwrap();
    assert_eq!(copied.opened.project_id, "project-copy");
    assert!(!copied.opened.read_only);
    f.store.close(&copied.opened.session).unwrap();
    f.store.close(&source.session).unwrap();
    fs::set_permissions(&original, permissions).unwrap();
    let copy_db = read_db(&dest);
    assert_eq!(meta(&copy_db, "project_id"), "project-copy");
    assert_eq!(meta(&copy_db, "copied_from_project_id"), PROJECT_ID);
    assert_eq!(meta(&read_db(&original), "project_id"), PROJECT_ID);
}

#[test]
fn copy_includes_unsaved_doc_view_and_journal() {
    let f = Fixture::new();
    let source = f.create("original.pcbk");
    f.store
        .save(&source.session, 0, 1, &doc(1), &[journal("saved")])
        .unwrap();
    f.store
        .save_view(&source.session, r#"{"panel":"saved"}"#)
        .unwrap();
    let dest = f.path("copy.pcbk");
    let view = r#"{"panel":"newest"}"#;
    let copied = f
        .store
        .copy(CopyRequest {
            rev: 2,
            view_json: Some(view),
            journal: &[journal("pending first"), journal("pending second")],
            ..request(&source, &dest, &doc(2))
        })
        .unwrap();
    assert_eq!(copied.opened.doc_json, doc(2));
    assert_eq!(copied.opened.view_json.as_deref(), Some(view));
    assert!(!copied.opened.read_only);
    f.store.close(&copied.opened.session).unwrap();
    f.store.close(&source.session).unwrap();
    let copy_db = read_db(&dest);
    assert_eq!(rev(&copy_db), 2);
    assert_eq!(
        summaries(&copy_db),
        ["saved", "pending first", "pending second"]
    );
    let original = read_db(f.path("original.pcbk"));
    assert_eq!(rev(&original), 1);
    assert_eq!(summaries(&original), ["saved"]);
}

#[test]
fn copy_rejects_newer_format() {
    let f = Fixture::new();
    let source = f.create("original.pcbk");
    let dest = f.path("existing.pcbk");
    let previous = f.store.create(&dest, "previous", &doc(0)).unwrap();
    f.store.close(&previous.session).unwrap();
    let before = fs::read(&dest).unwrap();
    let mut future: serde_json::Value = serde_json::from_str(&doc(1)).unwrap();
    future["format_version"] = (future["format_version"].as_u64().unwrap() + 1).into();

    let result = f.store.copy(request(&source, &dest, &future.to_string()));
    assert_eq!(result.unwrap_err().reason, Reason::TooNew);
    assert_eq!(fs::read(&dest).unwrap(), before);
    assert!(!fs::read_dir(f.path("")).unwrap().any(|entry| entry
        .unwrap()
        .path()
        .extension()
        .is_some_and(|ext| ext == "tmp")));
    f.store.close(&source.session).unwrap();
}

#[test]
fn restore_rejects_newer_document_backup_without_leaving_a_file() {
    let f = Fixture::new();
    let source = f.open_with_daily_backup("original.pcbk");
    f.store.close(&source.session).unwrap();
    let original = f.path("original.pcbk");
    let original_before = fs::read(&original).unwrap();
    let full = f.backups(BackupKind::Full).remove(0);
    let base = Path::new(&full.file);
    let base_before = fs::read(base).unwrap();
    let backup = base.with_file_name("20261109-103000.doc.json");
    let mut future: serde_json::Value = serde_json::from_str(&doc(1)).unwrap();
    future["format_version"] = (source.format_version + 1).into();
    let backup_before = serde_json::to_vec(&serde_json::json!({
        "base": name(&full.file),
        "rev": 1,
        "doc": future,
        "view": null,
    }))
    .unwrap();
    fs::write(&backup, &backup_before).unwrap();
    let destination_entries = || {
        fs::read_dir(f.path(""))
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect::<BTreeSet<_>>()
    };
    let entries_before = destination_entries();
    let dest = f.path("restored.pcbk");

    let result = f.store.restore(&backup, &dest);
    assert_eq!(result.unwrap_err().reason, Reason::TooNew);
    assert!(!dest.exists());
    assert_eq!(destination_entries(), entries_before);
    assert_eq!(fs::read(original).unwrap(), original_before);
    assert_eq!(fs::read(base).unwrap(), base_before);
    assert_eq!(fs::read(backup).unwrap(), backup_before);
}

// SQLite's Windows file handle denies delete sharing. The Windows counterpart
// exercises the same public operation with an injected missing path in storage.
#[cfg(not(windows))]
#[test]
fn copy_falls_back_to_memory_when_source_missing() {
    let f = Fixture::new();
    let source = f.create("original.pcbk");
    fs::remove_file(f.path("original.pcbk")).unwrap();
    let dest = f.path("rescued.pcbk");
    let view = r#"{"panel":"rescued"}"#;
    let copied = f
        .store
        .copy(CopyRequest {
            view_json: Some(view),
            journal: &[journal("rescued")],
            ..request(&source, &dest, &doc(1))
        })
        .unwrap();
    assert!(copied.from_memory);
    assert_eq!(copied.opened.doc_json, doc(1));
    assert_eq!(copied.opened.view_json.as_deref(), Some(view));
    f.store.close(&copied.opened.session).unwrap();
    f.store.close(&source.session).unwrap();
    assert_eq!(summaries(&read_db(&dest)), ["rescued"]);
}

#[test]
fn copy_replaces_confirmed_destination_but_not_open_source() {
    let f = Fixture::new();
    let source = f.create("original.pcbk");
    let dest = f.path("destination.pcbk");
    let other = f.store.create(&dest, "project-other", &doc(0)).unwrap();
    let original = f.path("original.pcbk");
    for blocked in [&original, &dest] {
        let token = replace_token(blocked).unwrap().unwrap();
        assert_eq!(
            f.store
                .copy(CopyRequest {
                    replace_token: Some(&token),
                    ..request(&source, blocked, &doc(1))
                })
                .unwrap_err()
                .reason,
            Reason::Locked
        );
    }
    f.store.close(&other.session).unwrap();
    let token = replace_token(&dest).unwrap().unwrap();
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;

        let before = fs::read(&dest).unwrap();
        // Simulate another process's handle denying replacement on Windows.
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(3)
            .open(&dest)
            .unwrap();
        assert_eq!(
            f.store
                .copy(CopyRequest {
                    replace_token: Some(&token),
                    ..request(&source, &dest, &doc(1))
                })
                .unwrap_err()
                .reason,
            Reason::Locked
        );
        assert_eq!(fs::read(&dest).unwrap(), before);
        drop(lock);
    }
    let copied = f
        .store
        .copy(CopyRequest {
            replace_token: Some(&token),
            ..request(&source, &dest, &doc(1))
        })
        .unwrap();
    assert_eq!(copied.opened.project_id, PROJECT_ID);
    f.store.close(&copied.opened.session).unwrap();
    f.store.close(&source.session).unwrap();
    assert_eq!(rev(&read_db(&original)), 0);
    assert_eq!(rev(&read_db(&dest)), 1);
}
