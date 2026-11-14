mod common;

use chrono::DateTime;
use common::{doc, journal, meta, name, read_db, read_json, rev, summaries, Fixture, PROJECT_ID};
use pcbk_desktop::storage::BackupKind;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::{fs, path::Path, time::SystemTime};

#[test]
fn daily_backup_uses_local_date_across_midnight() {
    let f = Fixture::new();
    f.clock.set("2026-11-09T23:59:00+02:00");
    let first = f.open_with_daily_backup("original.pcbk");
    f.store.close(&first.session).unwrap();
    f.clock.set("2026-11-10T00:01:00+02:00");
    let second = f.store.open(&f.path("original.pcbk")).unwrap();
    f.store.close(&second.session).unwrap();
    let copies = f.backups(BackupKind::Full);
    assert_eq!(
        copies
            .iter()
            .map(|item| name(&item.file))
            .collect::<Vec<_>>(),
        ["2026-11-10-000100-v1.pcbk", "2026-11-09-235900-v1.pcbk"]
    );
    for copy in copies {
        assert!(Path::new(&copy.file).is_absolute());
        assert!(!copy.file.starts_with(r"\\?\"));
        assert_eq!(
            DateTime::parse_from_rfc3339(&copy.at)
                .unwrap()
                .offset()
                .local_minus_utc(),
            0
        );
        assert!(copy.base.is_none());
        assert_eq!(rev(&read_db(&copy.file)), 0);
    }
}

#[test]
fn migration_backup_includes_same_day_work() {
    let f = Fixture::new();
    let opened = f.open_with_daily_backup("original.pcbk");
    let full = f.backups(BackupKind::Full).remove(0);
    let before = fs::read(&full.file).unwrap();
    f.save(&opened, 1);
    f.store.backup_full(&opened.session).unwrap();
    f.store.backup_full(&opened.session).unwrap();
    let copies = f.backups(BackupKind::Full);
    assert_eq!(copies.len(), 3);
    for copy in &copies[..2] {
        assert_eq!(rev(&read_db(&copy.file)), 1);
        assert_eq!(copy.at, full.at);
    }
    assert_eq!(fs::read(&full.file).unwrap(), before);
    assert_eq!(rev(&read_db(&full.file)), 0);
}

#[test]
fn doc_backup_every_30_min_references_its_full_base() {
    let f = Fixture::new();
    let opened = f.open_with_daily_backup("original.pcbk");
    let full = f.backups(BackupKind::Full).remove(0);
    f.store
        .save_view(&opened.session, r#"{"panel":"current"}"#)
        .unwrap();
    f.clock.set("2026-11-09T10:30:00+02:00");
    f.save(&opened, 1);
    assert_eq!(f.backups(BackupKind::Doc).len(), 1);
    f.clock.set("2026-11-09T10:59:59+02:00");
    f.save(&opened, 2);
    assert_eq!(f.backups(BackupKind::Doc).len(), 1);
    f.clock.set("2026-11-09T11:00:00+02:00");
    f.save(&opened, 3);

    let copies = f.backups(BackupKind::Doc);
    assert_eq!(copies.len(), 2);
    let latest = &copies[0];
    assert_eq!(name(&latest.file), "20261109-110000.doc.json");
    assert_eq!(latest.base.as_deref(), Some(name(&full.file)));
    assert_eq!(
        read_json(&latest.file),
        json!({
            "base": name(&full.file), "rev": 3,
            "doc": serde_json::from_str::<Value>(&doc(3)).unwrap(),
            "view": {"panel":"current"}
        })
    );
}

#[test]
fn media_dirty_forces_full_backup() {
    let f = Fixture::new();
    let path = f.path("original.pcbk");
    let opened = f.open_with_daily_backup("original.pcbk");
    let morning = f.backups(BackupKind::Full).remove(0);
    let before = fs::read(&morning.file).unwrap();
    f.store.close(&opened.session).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute("UPDATE meta SET value='1' WHERE key='media_dirty'", [])
        .unwrap();
    drop(db);

    // A forced backup in the same second cannot replace the existing file.
    let dirty = f.store.open(&path).unwrap();
    f.save(&dirty, 1);
    f.store.close(&dirty.session).unwrap();
    assert_eq!(f.backups(BackupKind::Full).len(), 1);
    assert_eq!(fs::read(&morning.file).unwrap(), before);
    assert_eq!(meta(&read_db(&path), "media_dirty"), "1");

    f.clock.set("2026-11-09T10:00:01+02:00");
    let dirty = f.store.open(&path).unwrap();
    f.save(&dirty, 2);
    f.store.close(&dirty.session).unwrap();
    let full = f.backups(BackupKind::Full);
    assert_eq!(full.len(), 2);
    assert_eq!(name(&full[0].file), "2026-11-09-100001-v1.pcbk");
    assert_eq!(rev(&read_db(&full[0].file)), 2);
    assert!(f.backups(BackupKind::Doc).is_empty());
    assert_eq!(meta(&read_db(&path), "media_dirty"), "0");
}

#[test]
fn forced_full_backup_never_overwrites_referenced_base() {
    let f = Fixture::new();
    let path = f.path("original.pcbk");
    let created = f.create("original.pcbk");
    f.store.close(&created.session).unwrap();
    let db = Connection::open(&path).unwrap();
    db.execute("INSERT INTO thumbnail(id,png) VALUES (1, X'01')", [])
        .unwrap();
    drop(db);

    let source = f.store.open(&path).unwrap();
    let morning = f.backups(BackupKind::Full).remove(0);
    assert_eq!(name(&morning.file), "2026-11-09-100000-v1.pcbk");
    let morning_bytes = fs::read(&morning.file).unwrap();
    f.clock.set("2026-11-09T10:30:00+02:00");
    f.save(&source, 1);
    let snapshot = f.backups(BackupKind::Doc).remove(0);
    assert_eq!(snapshot.base.as_deref(), Some(name(&morning.file)));
    let snapshot_bytes = fs::read(&snapshot.file).unwrap();
    f.store.close(&source.session).unwrap();

    let db = Connection::open(&path).unwrap();
    db.execute_batch(
        "UPDATE thumbnail SET png=X'02' WHERE id=1;
         UPDATE meta SET value='1' WHERE key='media_dirty';",
    )
    .unwrap();
    drop(db);
    f.clock.set("2026-11-09T11:00:00+02:00");
    let source = f.store.open(&path).unwrap();
    f.save(&source, 2);
    f.store.close(&source.session).unwrap();

    let fulls = f.backups(BackupKind::Full);
    assert_eq!(fulls.len(), 2);
    assert_eq!(name(&fulls[0].file), "2026-11-09-110000-v1.pcbk");
    let latest = read_db(&fulls[0].file);
    assert_eq!(rev(&latest), 2);
    assert_eq!(thumbnail(&latest), [2]);
    assert_eq!(fs::read(&morning.file).unwrap(), morning_bytes);
    assert_eq!(fs::read(&snapshot.file).unwrap(), snapshot_bytes);

    let dest = f.path("restored snapshot.pcbk");
    let restored = f.store.restore(Path::new(&snapshot.file), &dest).unwrap();
    f.store.close(&restored.session).unwrap();
    let restored = read_db(&dest);
    assert_eq!(rev(&restored), 1);
    assert_eq!(thumbnail(&restored), [1]);
}

fn thumbnail(db: &Connection) -> Vec<u8> {
    db.query_row("SELECT png FROM thumbnail WHERE id=1", [], |row| row.get(0))
        .unwrap()
}

#[test]
fn retention_keeps_referenced_full_backup() {
    let f = Fixture::new();
    let path = f.path("original.pcbk");
    let opened = f.open_with_daily_backup("original.pcbk");
    let protected = f.backups(BackupKind::Full).remove(0);
    f.clock.set("2026-11-09T10:30:00+02:00");
    f.save(&opened, 1);
    f.store.close(&opened.session).unwrap();
    for day in 10..=15 {
        f.clock.set(&format!("2026-11-{day}T10:00:00+02:00"));
        let session = f.store.open(&path).unwrap().session;
        f.store.close(&session).unwrap();
    }
    let full = f.backups(BackupKind::Full);
    assert_eq!(full.len(), 6);
    assert!(Path::new(&protected.file).is_file());
    assert!(!full
        .iter()
        .any(|copy| name(&copy.file) == "2026-11-10-100000-v1.pcbk"));
    let docs = f.backups(BackupKind::Doc);
    assert_eq!(docs.len(), 1);
    assert_eq!(docs[0].base.as_deref(), Some(name(&protected.file)));

    let opened = f.store.open(&path).unwrap();
    for (index, time) in ["10:30", "11:00", "11:30", "12:00", "12:30"]
        .iter()
        .enumerate()
    {
        f.clock.set(&format!("2026-11-15T{time}:00+02:00"));
        f.save(&opened, 2 + i64::try_from(index).unwrap());
    }
    assert_eq!(f.backups(BackupKind::Doc).len(), 5);
    assert_eq!(f.backups(BackupKind::Full).len(), 5);
    assert!(!Path::new(&protected.file).exists());
}

#[test]
fn backup_failure_does_not_fail_save() {
    let f = Fixture::new();
    fs::write(&f.app_data, b"not a directory").unwrap();
    let opened = f.open_with_daily_backup("original.pcbk");
    f.clock.set("2026-11-09T10:30:00+02:00");
    f.store
        .save(&opened.session, 0, 1, &doc(1), &[journal("committed")])
        .unwrap();
    f.store.close(&opened.session).unwrap();
    let db = read_db(f.path("original.pcbk"));
    assert_eq!(rev(&db), 1);
    assert_eq!(summaries(&db), ["committed"]);
}

#[test]
fn corrupt_documents_and_stranded_tmp_do_not_block_backups() {
    let f = Fixture::new();
    let created = f.create("original.pcbk");
    f.store.close(&created.session).unwrap();
    let dir = f
        .app_data
        .join("backups")
        .join(PROJECT_ID)
        .join(&created.file_id);
    fs::create_dir_all(&dir).unwrap();
    let oldest = dir.join("2026-11-01-v1.pcbk");
    for day in 1..=5 {
        let stamp =
            DateTime::parse_from_rfc3339(&format!("2026-11-{day:02}T08:00:00+02:00")).unwrap();
        let path = if day == 1 {
            oldest.clone()
        } else {
            dir.join(format!("2026-11-{day:02}-080000-v1.pcbk"))
        };
        fs::File::create(path)
            .unwrap()
            .set_modified(SystemTime::from(stamp))
            .unwrap();
    }
    let invalid_json = dir.join("20261106-070000.doc.json");
    let missing_base = dir.join("20261106-073000.doc.json");
    let stranded = dir.join("2026-11-06-080000-v1.pcbk.tmp");
    fs::write(&invalid_json, "{").unwrap();
    fs::write(&missing_base, r#"{"base":"2026-11-01-080000-v2.pcbk"}"#).unwrap();
    fs::write(&stranded, "partial").unwrap();
    assert_eq!(f.store.backups(PROJECT_ID).unwrap().len(), 5);

    f.clock.set("2026-11-06T08:00:00+02:00");
    let opened = f.store.open(&f.path("original.pcbk")).unwrap();
    f.store.close(&opened.session).unwrap();

    let backups = f.store.backups(PROJECT_ID).unwrap();
    assert_eq!(backups.len(), 5);
    assert!(backups.iter().all(|info| info.kind == BackupKind::Full));
    assert_eq!(name(&backups[0].file), "2026-11-06-080000-v1.pcbk");
    assert!(!oldest.exists());
    assert!(invalid_json.is_file());
    assert!(missing_base.is_file());
    assert_eq!(fs::read_to_string(stranded).unwrap(), "partial");
}
