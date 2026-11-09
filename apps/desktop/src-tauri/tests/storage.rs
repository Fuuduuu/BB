use pcbk_desktop::storage::{JournalDto, ProjectStore, Reason, SystemClock};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::{fs, path::Path};

fn test_store(path: &Path) -> ProjectStore {
    ProjectStore::new(path.join("app-data"), std::sync::Arc::new(SystemClock))
}

fn doc(rev: i64) -> String {
    json!({"format_version":1,"rev":rev,"name":"Plaat"}).to_string()
}
fn entry(summary: &str) -> JournalDto {
    JournalDto {
        at: "2026-11-09T00:00:00.000Z".into(),
        kind: "command".into(),
        command_id: "project.rename".into(),
        request_id: Some("request-a".into()),
        source: "user".into(),
        summary: summary.into(),
    }
}
fn create(store: &ProjectStore, path: &Path) -> String {
    store
        .create(path, "project_caller", &doc(0))
        .unwrap()
        .session
}
#[test]
fn create_open_save_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("board.pcbk");
    let store = test_store(dir.path());
    let session = create(&store, &path);
    store
        .save(&session, 0, 3, &doc(3), &[entry("three")])
        .unwrap();
    store.close(&session).unwrap();
    let opened = store.open(&path).unwrap();
    assert_eq!(opened.project_id, "project_caller");
    assert_eq!(opened.format_version, 1);
    assert!(!opened.read_only);
    assert_eq!(
        serde_json::from_str::<Value>(&opened.doc_json).unwrap(),
        serde_json::from_str::<Value>(&doc(3)).unwrap()
    );
    assert_ne!(session, opened.session);
    store.close(&opened.session).unwrap();
    let db = Connection::open(&path).unwrap();
    assert_eq!(
        db.query_row("SELECT count(*) FROM journal", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
    assert_eq!(
        db.query_row("SELECT request_id FROM journal", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "request-a"
    );
}
#[test]
fn save_rejects_wrong_base_rev() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("board.pcbk");
    let store = test_store(dir.path());
    let session = create(&store, &path);
    store
        .save(&session, 0, 3, &doc(3), &[entry("accepted")])
        .unwrap();
    let error = store
        .save(&session, 0, 4, &doc(4), &[entry("rejected")])
        .unwrap_err();
    assert_eq!(error.reason, Reason::StaleRev);
    assert_eq!(error.actual_rev, Some(3));
    store.close(&session).unwrap();
    let db = Connection::open(&path).unwrap();
    assert_eq!(
        db.query_row("SELECT rev FROM document", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        3
    );
    assert_eq!(
        db.query_row("SELECT count(*) FROM journal", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
}
#[test]
fn rejects_non_project_file_without_writing() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("foreign.pcbk");
    fs::write(&path, b"not a SQLite file").unwrap();
    let before = fs::read(&path).unwrap();
    let modified = fs::metadata(&path).unwrap().modified().unwrap();
    assert_eq!(
        test_store(dir.path()).open(&path).unwrap_err().reason,
        Reason::NotProject
    );
    assert_eq!(fs::read(&path).unwrap(), before);
    assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), modified);
}
#[test]
fn rejects_sqlite_file_without_meta() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("foreign.pcbk");
    let db = Connection::open(&path).unwrap();
    db.execute_batch(
        "PRAGMA journal_mode=WAL; CREATE TABLE other(data TEXT); INSERT INTO other VALUES('keep');",
    )
    .unwrap();
    drop(db);
    let before = fs::read(&path).unwrap();
    let modified = fs::metadata(&path).unwrap().modified().unwrap();
    assert_eq!(
        test_store(dir.path()).open(&path).unwrap_err().reason,
        Reason::NotProject
    );
    assert_eq!(fs::read(&path).unwrap(), before);
    assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), modified);
}
#[test]
fn read_only_file_opens_read_only_and_save_fails() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("readonly.pcbk");
    let store = test_store(dir.path());
    let session = create(&store, &path);
    store.close(&session).unwrap();
    let original = fs::metadata(&path).unwrap().permissions();
    let mut readonly = original.clone();
    readonly.set_readonly(true);
    fs::set_permissions(&path, readonly).unwrap();
    let result = store.open(&path);
    fs::set_permissions(&path, original).unwrap();
    let opened = result.unwrap();
    assert!(opened.read_only);
    assert_eq!(
        store
            .save(&opened.session, 0, 1, &doc(1), &[])
            .unwrap_err()
            .reason,
        Reason::ReadOnly
    );
    assert_eq!(
        store.save_view(&opened.session, "{}").unwrap_err().reason,
        Reason::ReadOnly
    );
    store.close(&opened.session).unwrap();
}
#[test]
fn opens_and_saves_path_with_estonian_letters_and_spaces() {
    let dir = tempfile::tempdir().unwrap();
    let folder = dir.path().join("Kasutaja õ");
    fs::create_dir(&folder).unwrap();
    let path = folder.join("Plaat õäöü (2).pcbk");
    let store = test_store(dir.path());
    let session = create(&store, &path);
    store.save(&session, 0, 1, &doc(1), &[]).unwrap();
    store.close(&session).unwrap();
    let opened = store.open(&path).unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&opened.doc_json).unwrap()["rev"],
        1
    );
    store.close(&opened.session).unwrap();
}
#[test]
fn view_save_keeps_rev() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("view.pcbk");
    let store = test_store(dir.path());
    let session = create(&store, &path);
    let view = r#"{"navigatorWidth":300,"navigatorTab":"components","contextWidth":360,"contextOpen":false}"#;
    store.save_view(&session, view).unwrap();
    store.close(&session).unwrap();
    let opened = store.open(&path).unwrap();
    assert_eq!(opened.view_json.as_deref(), Some(view));
    assert_eq!(
        serde_json::from_str::<Value>(&opened.doc_json).unwrap()["rev"],
        0
    );
    store.close(&opened.session).unwrap();
}

#[cfg(windows)]
#[test]
fn opened_path_has_no_verbatim_prefix() {
    use std::path::{Component, Prefix};

    let dir = tempfile::tempdir().unwrap();
    let path = std::path::absolute(dir.path().join("Plaat õäöü (2).pcbk")).unwrap();
    let store = test_store(dir.path());
    let created = store.create(&path, "project_caller", &doc(0)).unwrap();
    store.close(&created.session).unwrap();
    let reopened = store.open(&path).unwrap();
    store.close(&reopened.session).unwrap();

    for actual in [created.path, reopened.path] {
        assert!(
            matches!(Path::new(&actual).components().next(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), Prefix::Disk(_))),
            "expected a drive-letter path, got {actual}"
        );
        assert_eq!(actual, path.to_str().unwrap());
    }
}
#[test]
fn unknown_session_is_unknown() {
    let dir = tempfile::tempdir().unwrap();
    let store = test_store(dir.path());
    assert_eq!(
        store.close("not-a-session").unwrap_err().reason,
        Reason::Unknown
    );
}

#[test]
fn journal_failure_rolls_back_document_and_all_new_entries() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("atomic.pcbk");
    let store = test_store(dir.path());
    let session = create(&store, &path);
    store.close(&session).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute_batch("CREATE TRIGGER fail_journal BEFORE INSERT ON journal WHEN NEW.summary='reject' BEGIN SELECT RAISE(ABORT,'injected failure'); END;").unwrap();
    drop(db);
    let opened = store.open(&path).unwrap();
    assert_eq!(
        store
            .save(
                &opened.session,
                0,
                1,
                &doc(1),
                &[entry("first"), entry("reject")]
            )
            .unwrap_err()
            .reason,
        Reason::Unknown
    );
    store.close(&opened.session).unwrap();
    let db = Connection::open(&path).unwrap();
    assert_eq!(
        db.query_row("SELECT json FROM document", [], |r| r.get::<_, String>(0))
            .unwrap(),
        doc(0)
    );
    assert_eq!(
        db.query_row("SELECT rev FROM document", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        db.query_row("SELECT count(*) FROM journal", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn confirmed_create_replaces_file_only_after_building_new_project() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("replace.pcbk");
    let tmp = dir.path().join("replace.pcbk.tmp");
    let store = test_store(dir.path());
    let session = create(&store, &path);
    store.close(&session).unwrap();
    let before = fs::read(&path).unwrap();
    let modified = fs::metadata(&path).unwrap().modified().unwrap();
    assert!(store.create(&path, "replacement", "invalid JSON").is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
    assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), modified);
    fs::write(&tmp, b"existing temporary file").unwrap();
    assert!(store.create(&path, "replacement", &doc(0)).is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
    assert_eq!(fs::read(&tmp).unwrap(), b"existing temporary file");
    fs::remove_file(&tmp).unwrap();
    let opened = store.create(&path, "replacement", &doc(0)).unwrap();
    assert_eq!(opened.project_id, "replacement");
    assert!(!tmp.exists());
    store.close(&opened.session).unwrap();
    let reopened = store.open(&path).unwrap();
    assert_eq!(reopened.project_id, "replacement");
    store.close(&reopened.session).unwrap();
}

#[test]
fn rejects_missing_and_newer_files_without_modifying_them() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("future.pcbk");
    let store = test_store(dir.path());
    assert_eq!(store.open(&path).unwrap_err().reason, Reason::Missing);
    assert!(!path.exists());
    let session = create(&store, &path);
    store.close(&session).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute("UPDATE meta SET value='2' WHERE key='format_version'", [])
        .unwrap();
    drop(db);
    let before = fs::read(&path).unwrap();
    let modified = fs::metadata(&path).unwrap().modified().unwrap();
    assert_eq!(store.open(&path).unwrap_err().reason, Reason::TooNew);
    assert_eq!(fs::read(&path).unwrap(), before);
    assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), modified);
}

#[test]
fn file_becoming_read_only_rejects_save_and_preserves_document() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("changed.pcbk");
    let store = test_store(dir.path());
    let session = create(&store, &path);
    let original = fs::metadata(&path).unwrap().permissions();
    let mut readonly = original.clone();
    readonly.set_readonly(true);
    fs::set_permissions(&path, readonly).unwrap();
    let result = store.save(&session, 0, 1, &doc(1), &[entry("rejected")]);
    fs::set_permissions(&path, original).unwrap();
    assert_eq!(result.unwrap_err().reason, Reason::ReadOnly);
    store.close(&session).unwrap();
    let reopened = store.open(&path).unwrap();
    assert_eq!(reopened.doc_json, doc(0));
    store.close(&reopened.session).unwrap();
}
