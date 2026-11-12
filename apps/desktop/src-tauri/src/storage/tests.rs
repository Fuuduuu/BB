use super::*;

#[test]
fn copy_falls_back_to_memory_when_source_missing() {
    let dir = tempfile::tempdir().unwrap();
    let source = dir.path().join("source.pcbk");
    let destination = dir.path().join("rescued.pcbk");
    let missing = dir.path().join("missing.pcbk");
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
    let opened = store
        .create(&source, "original", r#"{"format_version":1,"rev":0}"#)
        .unwrap();
    // Windows SQLite keeps an open file from being unlinked. Point this
    // session at a genuinely absent path to exercise the same I/O failure.
    store
        .sessions()
        .unwrap()
        .get_mut(&opened.session)
        .unwrap()
        .path = missing;
    let doc = r#"{"format_version":1,"rev":3,"name":"Rescued"}"#;
    let view = r#"{"navigatorWidth":320}"#;
    let journal = [JournalDto {
        at: "2026-11-09T01:00:00Z".into(),
        kind: "command".into(),
        command_id: "project.rename".into(),
        request_id: None,
        source: "user".into(),
        summary: "Rescued".into(),
    }];
    let result = store
        .copy(CopyRequest {
            session: &opened.session,
            dest: &destination,
            project_id: "rescued",
            copied_from_project_id: Some("original"),
            doc_json: doc,
            rev: 3,
            view_json: Some(view),
            journal: &journal,
        })
        .unwrap();
    assert!(result.from_memory);
    assert!(!result.opened.read_only);
    assert_eq!(result.opened.doc_json, doc);
    assert_eq!(result.opened.view_json.as_deref(), Some(view));
    store.close(&result.opened.session).unwrap();
    store.close(&opened.session).unwrap();
    let conn = rusqlite::Connection::open(destination).unwrap();
    let count: u32 = conn
        .query_row("SELECT count(*) FROM journal", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 1);
}
