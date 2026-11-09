mod common;

use common::{doc, journal, name, read_db, read_json, rev, summaries, Fixture, PROJECT_ID};
use pcbk_desktop::storage::{BackupKind, Reason};
use serde_json::Value;
use std::{fs, path::Path};

#[test]
fn restore_full_and_doc_backup_into_new_file() {
    let f = Fixture::new();
    let source = f.create("original.pcbk");
    let initial_view = r#"{"panel":"initial"}"#;
    f.store.save_view(&source.session, initial_view).unwrap();
    f.store.close(&source.session).unwrap();
    let source = f.store.open(&f.path("original.pcbk")).unwrap();
    let full = f.backups(BackupKind::Full).remove(0);
    let latest_view = r#"{"panel":"latest"}"#;
    f.store.save_view(&source.session, latest_view).unwrap();
    f.clock.set("2026-11-09T10:30:00+02:00");
    f.save(&source, 1);
    let snapshot = f.backups(BackupKind::Doc).remove(0);
    f.store.close(&source.session).unwrap();
    let original = f.path("original.pcbk");
    let original_before = fs::read(&original).unwrap();
    let full_before = fs::read(&full.file).unwrap();
    let snapshot_before = fs::read(&snapshot.file).unwrap();
    for (backup, dest, expected_rev, view) in [
        (&full, f.path("full restored.pcbk"), 0, initial_view),
        (&snapshot, f.path("doc restored.pcbk"), 1, latest_view),
    ] {
        assert!(!dest.exists());
        let restored = f.store.restore(Path::new(&backup.file), &dest).unwrap();
        assert_eq!(restored.project_id, PROJECT_ID);
        assert_eq!(
            serde_json::from_str::<Value>(&restored.doc_json).unwrap()["rev"],
            expected_rev
        );
        assert_eq!(
            serde_json::from_str::<Value>(restored.view_json.as_deref().unwrap()).unwrap(),
            serde_json::from_str::<Value>(view).unwrap()
        );
        assert!(!restored.read_only);
        f.store.close(&restored.session).unwrap();
        let db = read_db(&dest);
        let integrity: String = db
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .unwrap();
        assert_eq!(integrity, "ok");
        assert_eq!(rev(&db), expected_rev);
    }
    assert!(
        fs::read(&original).unwrap() == original_before,
        "original changed"
    );
    assert!(
        fs::read(&full.file).unwrap() == full_before,
        "base backup changed"
    );
    assert!(
        fs::read(&snapshot.file).unwrap() == snapshot_before,
        "document backup changed"
    );
    assert_eq!(rev(&read_db(original)), 1);
}

#[test]
fn restore_keeps_a_writable_session_and_persists_later_revision() {
    let f = Fixture::new();
    let source = f.open_with_daily_backup("original.pcbk");
    f.store.close(&source.session).unwrap();
    let backup = f.backups(BackupKind::Full).remove(0);
    let backup_before = fs::read(&backup.file).unwrap();
    let original = f.path("original.pcbk");
    let original_before = fs::read(&original).unwrap();

    let dest = f.path("restored.pcbk");
    let restored = f.store.restore(Path::new(&backup.file), &dest).unwrap();
    assert!(!restored.read_only);
    assert_eq!(
        serde_json::from_str::<Value>(&restored.doc_json).unwrap()["rev"],
        0
    );
    f.store
        .save(
            &restored.session,
            0,
            1,
            &doc(1),
            &[journal("after restore")],
        )
        .unwrap();
    f.store.close(&restored.session).unwrap();

    let reopened = f.store.open(&dest).unwrap();
    assert_eq!(reopened.project_id, PROJECT_ID);
    assert_eq!(
        serde_json::from_str::<Value>(&reopened.doc_json).unwrap()["rev"],
        1
    );
    f.store.close(&reopened.session).unwrap();
    let db = read_db(&dest);
    assert_eq!(rev(&db), 1);
    assert_eq!(summaries(&db), ["after restore"]);
    let mode: String = db
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .unwrap();
    assert_eq!(mode, "delete");
    assert!(
        fs::read(&original).unwrap() == original_before,
        "original changed"
    );
    assert!(
        fs::read(&backup.file).unwrap() == backup_before,
        "backup changed"
    );
}

#[test]
fn restore_rejects_path_outside_backups() {
    let f = Fixture::new();
    f.open_with_daily_backup("original.pcbk");
    let full = f.backups(BackupKind::Full).remove(0);
    let outside = f.path("outside.pcbk");
    fs::copy(&full.file, &outside).unwrap();
    let dest = f.path("untouched.pcbk");
    assert_eq!(
        f.store.restore(&outside, &dest).unwrap_err().reason,
        Reason::Unknown
    );
    assert!(!dest.exists());
}

#[test]
fn restore_rejects_original_and_other_existing_project() {
    let f = Fixture::new();
    let original = f.path("original.pcbk");
    let source = f.open_with_daily_backup("original.pcbk");
    let backup = f.backups(BackupKind::Full).remove(0);
    let backup_before = fs::read(&backup.file).unwrap();
    f.save(&source, 1);
    f.store.close(&source.session).unwrap();

    let other = f.path("other.pcbk");
    let project = f.store.create(&other, "project-other", &doc(0)).unwrap();
    f.store.close(&project.session).unwrap();

    for dest in [original, other] {
        let before = fs::read(&dest).unwrap();
        let error = f
            .store
            .restore(Path::new(&backup.file), &dest)
            .expect_err("restore must refuse an existing project");
        assert_eq!(
            serde_json::to_value(error).unwrap(),
            serde_json::json!({"reason": "exists", "actual_rev": null})
        );
        assert!(
            fs::read(&dest).unwrap() == before,
            "existing project changed"
        );
        assert!(
            fs::read(&backup.file).unwrap() == backup_before,
            "backup changed"
        );
    }
}

#[test]
fn restore_rejects_target_with_orphan_sidecars() {
    let f = Fixture::new();
    let source = f.open_with_daily_backup("original.pcbk");
    f.store.close(&source.session).unwrap();
    let backup = f.backups(BackupKind::Full).remove(0);
    let backup_before = fs::read(&backup.file).unwrap();
    for suffix in ["-journal", "-wal", "-shm"] {
        let dest = f.path(&format!("free{suffix}.pcbk"));
        let sidecar = f.path(&format!("free{suffix}.pcbk{suffix}"));
        fs::write(&sidecar, b"foreign SQLite file").unwrap();
        let error = f
            .store
            .restore(Path::new(&backup.file), &dest)
            .expect_err("restore must refuse a SQLite sidecar");
        assert_eq!(error.reason, Reason::Exists);
        assert!(!dest.exists());
        assert_eq!(fs::read(&sidecar).unwrap(), b"foreign SQLite file");
        assert!(
            fs::read(&backup.file).unwrap() == backup_before,
            "backup changed"
        );
    }
}

#[cfg(unix)]
#[test]
fn restore_rejects_dangling_symlinks() {
    let f = Fixture::new();
    let source = f.open_with_daily_backup("original.pcbk");
    f.store.close(&source.session).unwrap();
    let backup = f.backups(BackupKind::Full).remove(0);
    let missing = f.path("absent.pcbk");
    let destination_link = f.path("destination-link.pcbk");
    let orphan_destination = f.path("sidecar-link.pcbk");
    let sidecar_link = f.path("sidecar-link.pcbk-journal");
    for (dest, link) in [
        (&destination_link, &destination_link),
        (&orphan_destination, &sidecar_link),
    ] {
        std::os::unix::fs::symlink(&missing, link).unwrap();
        let error = f.store.restore(Path::new(&backup.file), dest).unwrap_err();
        assert_eq!(error.reason, Reason::Exists);
        assert_eq!(fs::read_link(link).unwrap(), missing);
        assert!(!dest.exists());
    }
    assert!(!missing.exists());
}

#[test]
fn recent_list_caps_at_ten_dedups_and_marks_missing() {
    let f = Fixture::new();
    let exists = f.path("board-11.pcbk");
    fs::write(&exists, b"existing path").unwrap();
    for index in 0..12 {
        f.clock.set(&format!("2026-11-09T10:00:{index:02}+02:00"));
        f.store
            .recent_add(
                &f.path(&format!("board-{index}.pcbk")),
                &format!("Board {index}"),
                PROJECT_ID,
            )
            .unwrap();
    }
    let list = f.store.recent_list().unwrap();
    assert_eq!(list.len(), 10);
    assert_eq!(list[0].name, "Board 11");
    assert!(list[0].exists);
    assert!(!list[1].exists);
    assert_eq!(list[9].name, "Board 2");
    assert_eq!(list[0].project_id, PROJECT_ID);

    let duplicate = f.path("board-10.pcbk");
    f.clock.set("2026-11-09T10:01:00+02:00");
    f.store
        .recent_add(&duplicate, "Renamed board", "new-id")
        .unwrap();
    let list = f.store.recent_list().unwrap();
    assert_eq!(list.len(), 10);
    assert_eq!(list[0].name, "Renamed board");
    assert_eq!(list[0].project_id, "new-id");
    assert_eq!(
        list.iter()
            .filter(|item| name(&item.path) == "board-10.pcbk")
            .count(),
        1
    );
    f.store.recent_remove(&duplicate).unwrap();
    assert_eq!(f.store.recent_list().unwrap().len(), 9);
    assert!(!f.app_data.join("recent.json.tmp").exists());
}

#[test]
fn corrupt_recent_json_reads_as_empty() {
    let f = Fixture::new();
    fs::create_dir_all(&f.app_data).unwrap();
    let recent_file = f.app_data.join("recent.json");
    fs::write(&recent_file, b"{broken").unwrap();
    assert!(f.store.recent_list().unwrap().is_empty());
    assert_eq!(fs::read(&recent_file).unwrap(), b"{broken");
    f.store
        .recent_add(&f.path("new.pcbk"), "New", PROJECT_ID)
        .unwrap();
    assert_eq!(f.store.recent_list().unwrap()[0].name, "New");
    assert!(read_json(&recent_file).is_array());
}
