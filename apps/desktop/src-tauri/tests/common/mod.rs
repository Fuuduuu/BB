// Each integration-test crate uses a different subset of this fixture.
#![allow(dead_code)]

use chrono::{DateTime, FixedOffset};
use pcbk_desktop::storage::{
    BackupInfoDto, BackupKind, Clock, JournalDto, OpenedProjectDto, ProjectStore,
};
use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

pub(super) const PROJECT_ID: &str = "project-board";
const FIRST_DAY: &str = "2026-11-09T10:00:00+02:00";

pub(super) struct TestClock(Mutex<DateTime<FixedOffset>>);

impl TestClock {
    pub(super) fn set(&self, time: &str) {
        *self.0.lock().unwrap() = DateTime::parse_from_rfc3339(time).unwrap();
    }
}

impl Clock for TestClock {
    fn now(&self) -> DateTime<FixedOffset> {
        *self.0.lock().unwrap()
    }
}

pub(super) struct Fixture {
    pub(super) store: ProjectStore,
    pub(super) clock: Arc<TestClock>,
    pub(super) app_data: PathBuf,
    root: tempfile::TempDir,
}

impl Fixture {
    pub(super) fn new() -> Self {
        let root = tempfile::tempdir().unwrap();
        let app_data = root.path().join("app-data");
        let clock = Arc::new(TestClock(Mutex::new(
            DateTime::parse_from_rfc3339(FIRST_DAY).unwrap(),
        )));
        let store = ProjectStore::new(app_data.clone(), clock.clone());
        Self {
            store,
            clock,
            app_data,
            root,
        }
    }

    pub(super) fn path(&self, name: &str) -> PathBuf {
        self.root.path().join(name)
    }

    pub(super) fn create(&self, name: &str) -> OpenedProjectDto {
        self.store
            .create(&self.path(name), PROJECT_ID, &doc(0))
            .unwrap()
    }

    pub(super) fn open_with_daily_backup(&self, name: &str) -> OpenedProjectDto {
        let created = self.create(name);
        self.store.close(&created.session).unwrap();
        self.store.open(&self.path(name)).unwrap()
    }

    pub(super) fn backups(&self, kind: BackupKind) -> Vec<BackupInfoDto> {
        self.store
            .backups(PROJECT_ID)
            .unwrap()
            .into_iter()
            .filter(|item| item.kind == kind)
            .collect()
    }

    pub(super) fn save(&self, project: &OpenedProjectDto, rev: i64) {
        self.store
            .save(&project.session, rev - 1, rev, &doc(rev), &[])
            .unwrap();
    }
}

pub(super) fn doc(rev: i64) -> String {
    json!({ "format_version": 1, "rev": rev, "name": "Plaat õäöü" }).to_string()
}

pub(super) fn journal(summary: &str) -> JournalDto {
    JournalDto {
        at: "2026-11-09T08:00:00Z".into(),
        kind: "command".into(),
        command_id: "project.rename".into(),
        request_id: Some(summary.into()),
        source: "user".into(),
        summary: summary.into(),
    }
}

pub(super) fn read_db(path: impl AsRef<Path>) -> Connection {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap()
}

pub(super) fn meta(db: &Connection, key: &str) -> String {
    db.query_row("SELECT value FROM meta WHERE key=?1", [key], |row| {
        row.get(0)
    })
    .unwrap()
}

pub(super) fn rev(db: &Connection) -> i64 {
    db.query_row("SELECT rev FROM document WHERE id=1", [], |row| row.get(0))
        .unwrap()
}

pub(super) fn summaries(db: &Connection) -> Vec<String> {
    db.prepare("SELECT summary FROM journal ORDER BY seq")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap()
}

pub(super) fn name(file: &str) -> &str {
    Path::new(file).file_name().unwrap().to_str().unwrap()
}

pub(super) fn read_json(path: impl AsRef<Path>) -> Value {
    serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
}
