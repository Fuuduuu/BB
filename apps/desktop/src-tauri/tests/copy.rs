mod common;

use common::{doc, journal, meta, read_db, rev, summaries, Fixture, PROJECT_ID};
use pcbk_desktop::storage::{BackupKind, CopyRequest, OpenedProjectDto, Reason};
use rusqlite::Connection;
use std::{fs, path::Path};

fn request<'a>(source: &'a OpenedProjectDto, dest: &'a Path, doc_json: &'a str) -> CopyRequest<'a> {
    CopyRequest {
        session: &source.session,
        dest,
        project_id: &source.project_id,
        copied_from_project_id: None,
        doc_json,
        rev: 1,
        view_json: None,
        journal: &[],
    }
}

#[test]
fn copy_goes_through_tmp_and_keeps_original() {
    let f = Fixture::new();
    let original = f.path("Algne plaat õ.pcbk");
    let initial = f.create("Algne plaat õ.pcbk");
    f.store.close(&initial.session).unwrap();
    let db = Connection::open(&original).unwrap();
    db.execute("INSERT INTO thumbnail(id,png) VALUES (1, X'0102')", [])
        .unwrap();
    drop(db);
    let before = fs::read(&original).unwrap();
    let source = f.store.open(&original).unwrap();
    let dest = f.path("Koopia õ.pcbk");
    let tmp = f.path("Koopia õ.pcbk.tmp");
    fs::write(&tmp, b"existing temporary file").unwrap();
    assert!(f.store.copy(request(&source, &dest, &doc(1))).is_err());
    assert!(!dest.exists());
    assert_eq!(fs::read(&tmp).unwrap(), b"existing temporary file");
    fs::remove_file(&tmp).unwrap();

    let copied = f.store.copy(request(&source, &dest, &doc(1))).unwrap();
    assert!(!copied.from_memory);
    assert_ne!(source.session, copied.opened.session);
    assert!(!tmp.exists());
    f.store.close(&copied.opened.session).unwrap();
    f.store.close(&source.session).unwrap();
    assert_eq!(fs::read(&original).unwrap(), before);
    let db = read_db(&dest);
    assert_eq!(rev(&db), 1);
    let thumbnail: Vec<u8> = db
        .query_row("SELECT png FROM thumbnail", [], |row| row.get(0))
        .unwrap();
    assert_eq!(thumbnail, [1, 2]);
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
    assert_eq!(f.backups(BackupKind::Full).len(), 1);
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
        assert_eq!(
            f.store
                .copy(request(&source, blocked, &doc(1)))
                .unwrap_err()
                .reason,
            Reason::Locked
        );
    }
    f.store.close(&other.session).unwrap();
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
                .copy(request(&source, &dest, &doc(1)))
                .unwrap_err()
                .reason,
            Reason::Locked
        );
        assert_eq!(fs::read(&dest).unwrap(), before);
        drop(lock);
    }
    let copied = f.store.copy(request(&source, &dest, &doc(1))).unwrap();
    assert_eq!(copied.opened.project_id, PROJECT_ID);
    f.store.close(&copied.opened.session).unwrap();
    f.store.close(&source.session).unwrap();
    assert_eq!(rev(&read_db(&original)), 0);
    assert_eq!(rev(&read_db(&dest)), 1);
}
