use super::*;

#[test]
fn auto_named_create_never_replaces_existing_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = crate::desktop_paths::default_project_path(dir.path(), "Automatic").unwrap();
    assert!(!path.exists());
    let before = b"synthetic file created after the automatic name was selected";
    fs::write(&path, before).unwrap();
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));

    let result = store.create_with_exclusive(
        &path,
        "new-project",
        r#"{"format_version":1,"rev":0,"name":"Automatic"}"#,
        true,
    );

    assert!(
        result.is_err(),
        "automatic creation replaced the occupied file"
    );
    assert_eq!(
        serde_json::to_value(result.unwrap_err()).unwrap()["reason"],
        "path_taken"
    );
    assert_eq!(fs::read(&path).unwrap(), before);
    let remaining: Vec<_> = fs::read_dir(path.parent().unwrap())
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .collect();
    assert_eq!(remaining, vec![path.clone()]);

    let next_path = crate::desktop_paths::default_project_path(dir.path(), "Automatic").unwrap();
    assert_ne!(next_path, path);
    let created = store
        .create_with_exclusive(
            &next_path,
            "new-project",
            r#"{"format_version":1,"rev":0,"name":"Automatic"}"#,
            true,
        )
        .unwrap();
    store.close(&created.session).unwrap();
    let reopened = store.open(&next_path).unwrap();
    assert_eq!(reopened.project_id, "new-project");
    assert_eq!(reopened.file_id, created.file_id);
    assert_eq!(
        reopened.doc_json,
        r#"{"format_version":1,"rev":0,"name":"Automatic"}"#
    );
    store.close(&reopened.session).unwrap();
    assert_eq!(fs::read(&path).unwrap(), before);
}

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
