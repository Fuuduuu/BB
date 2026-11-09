mod backup;
mod clock;
mod copy;
mod db;
mod error;
mod recent;
mod restore;
mod schema;

pub use backup::{BackupInfoDto, BackupKind};
pub use clock::{Clock, SystemClock};
pub use copy::{CopyRequest, CopyResultDto};
pub use error::{Reason, StorageErrorDto, StorageResult};
pub use recent::RecentDto;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub struct OpenedProjectDto {
    pub session: String,
    pub project_id: String,
    pub path: String,
    pub doc_json: String,
    pub view_json: Option<String>,
    pub format_version: u32,
    pub read_only: bool,
    pub saved_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub struct JournalDto {
    pub at: String,
    pub kind: String,
    pub command_id: String,
    pub request_id: Option<String>,
    pub source: String,
    pub summary: String,
}

pub struct ProjectStore {
    sessions: Mutex<HashMap<String, db::ProjectDb>>,
    app_data: PathBuf,
    clock: Arc<dyn Clock + Send + Sync>,
    recent_lock: Mutex<()>,
}

struct PendingFile(Option<PathBuf>);

impl PendingFile {
    fn unique(destination: &Path) -> StorageResult<Self> {
        let mut path = destination.as_os_str().to_owned();
        path.push(format!(".{}.tmp", uuid::Uuid::new_v4()));
        let path = PathBuf::from(path);
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)?;
        Ok(Self(Some(path)))
    }

    fn path(&self) -> &Path {
        self.0.as_deref().expect("pending file is armed")
    }

    fn sync(&self) -> std::io::Result<()> {
        fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(self.path())?
            .sync_all()
    }

    fn publish(mut self, destination: &Path) -> StorageResult<()> {
        self.sync()?;
        replace_file(self.path(), destination)?;
        // After rename, this operation no longer owns the temporary path.
        self.0 = None;
        Ok(())
    }
}

fn replace_file(source: &Path, destination: &Path) -> StorageResult<()> {
    let Err(error) = fs::rename(source, destination) else {
        return Ok(());
    };
    #[cfg(windows)]
    if error.kind() == std::io::ErrorKind::PermissionDenied {
        use std::os::windows::fs::OpenOptionsExt;

        // MoveFileEx may report access denied when the destination is open
        // without delete sharing. A DELETE-access probe distinguishes the lock.
        const DELETE_ACCESS: u32 = 0x0001_0000;
        const SHARE_ALL: u32 = 0x7;
        if let Err(probe) = fs::OpenOptions::new()
            .access_mode(DELETE_ACCESS)
            .share_mode(SHARE_ALL)
            .open(destination)
        {
            let mapped = StorageErrorDto::from(probe);
            if mapped.reason == Reason::Locked {
                return Err(mapped);
            }
        }
    }
    Err(error.into())
}

impl Drop for PendingFile {
    fn drop(&mut self) {
        if let Some(path) = &self.0 {
            let _ = fs::remove_file(path);
        }
    }
}

fn absolute(path: &Path) -> StorageResult<PathBuf> {
    if path.exists() {
        Ok(dunce::canonicalize(path)?)
    } else {
        let path = std::path::absolute(path)?;
        Ok(dunce::simplified(&path).to_path_buf())
    }
}

impl ProjectStore {
    pub fn new(app_data: PathBuf, clock: Arc<dyn Clock + Send + Sync>) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            app_data,
            clock,
            recent_lock: Mutex::new(()),
        }
    }

    fn sessions(&self) -> StorageResult<MutexGuard<'_, HashMap<String, db::ProjectDb>>> {
        self.sessions
            .lock()
            .map_err(|_| StorageErrorDto::new(Reason::Unknown))
    }

    fn available_path(
        path: &Path,
        sessions: &HashMap<String, db::ProjectDb>,
    ) -> StorageResult<PathBuf> {
        let path = absolute(path)?;
        if sessions.values().any(|db| db.path == path) {
            return Err(StorageErrorDto::new(Reason::Locked));
        }
        Ok(path)
    }

    fn destination(
        path: &Path,
        sessions: &HashMap<String, db::ProjectDb>,
    ) -> StorageResult<PathBuf> {
        let path = Self::available_path(path, sessions)?;
        match fs::metadata(&path) {
            Ok(metadata) if metadata.permissions().readonly() => {
                return Err(StorageErrorDto::new(Reason::ReadOnly));
            }
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => return Err(error.into()),
            _ => {}
        }
        Ok(path)
    }

    fn register(
        &self,
        sessions: &mut HashMap<String, db::ProjectDb>,
        db: db::ProjectDb,
        daily_backup: bool,
    ) -> StorageResult<OpenedProjectDto> {
        let session = uuid::Uuid::new_v4().to_string();
        let opened = db.describe(session.clone())?;
        if daily_backup {
            if let Err(error) = backup::daily(&self.app_data, &db, self.clock.now()) {
                log::warn!("Project backup after open failed: {error:?}");
            }
        }
        sessions.insert(session, db);
        Ok(opened)
    }

    pub fn create(
        &self,
        path: &Path,
        project_id: &str,
        doc_json: &str,
    ) -> StorageResult<OpenedProjectDto> {
        db::document_header(doc_json)?;
        if project_id.trim().is_empty() {
            return Err(StorageErrorDto::new(Reason::Unknown));
        }
        let mut sessions = self.sessions()?;
        let path = Self::destination(path, &sessions)?;
        let pending = PendingFile::unique(&path)?;
        {
            let mut conn = rusqlite::Connection::open_with_flags(
                pending.path(),
                rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
                    | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )?;
            schema::initialize(&mut conn, project_id, doc_json)?;
            conn.close()
                .map_err(|(_, error)| StorageErrorDto::from(error))?;
        }
        pending.publish(&path)?;
        self.register(&mut sessions, db::ProjectDb::open(&path)?, false)
    }
    pub fn open(&self, path: &Path) -> StorageResult<OpenedProjectDto> {
        let mut sessions = self.sessions()?;
        let path = Self::available_path(path, &sessions)?;
        self.register(&mut sessions, db::ProjectDb::open(&path)?, true)
    }
    pub fn save(
        &self,
        session: &str,
        base_rev: i64,
        rev: i64,
        doc_json: &str,
        journal: &[JournalDto],
    ) -> StorageResult<()> {
        let mut sessions = self.sessions()?;
        let db = sessions
            .get_mut(session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
        db.save(base_rev, rev, doc_json, journal)?;
        if let Err(error) = backup::after_save(&self.app_data, db, self.clock.now()) {
            log::warn!("Project backup after save failed: {error:?}");
        }
        Ok(())
    }
    pub fn save_view(&self, session: &str, view_json: &str) -> StorageResult<()> {
        self.sessions()?
            .get_mut(session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?
            .save_view(view_json)
    }

    pub fn copy(&self, request: CopyRequest<'_>) -> StorageResult<CopyResultDto> {
        let mut sessions = self.sessions()?;
        let source = sessions
            .get(request.session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
        let destination = Self::destination(request.dest, &sessions)?;
        let from_memory = copy::write(source, &destination, &request)?;
        let opened = self.register(&mut sessions, db::ProjectDb::open(&destination)?, false)?;
        Ok(CopyResultDto {
            opened,
            from_memory,
        })
    }

    pub fn backup_full(&self, session: &str) -> StorageResult<()> {
        let sessions = self.sessions()?;
        let db = sessions
            .get(session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
        backup::migration(&self.app_data, db, self.clock.now())
    }

    pub fn backups(&self, project_id: &str) -> StorageResult<Vec<BackupInfoDto>> {
        let _sessions = self.sessions()?;
        backup::list(&self.app_data, project_id)
    }

    pub fn restore(&self, backup: &Path, destination: &Path) -> StorageResult<OpenedProjectDto> {
        let mut sessions = self.sessions()?;
        let destination = restore::destination(destination)?;
        if sessions.values().any(|db| db.path == destination) {
            return Err(StorageErrorDto::new(Reason::Locked));
        }
        restore::write(&self.app_data, backup, &destination)?;
        let (db, opened) = restore::open_published(&destination)?;
        sessions.insert(opened.session.clone(), db);
        Ok(opened)
    }

    fn recent_guard(&self) -> StorageResult<MutexGuard<'_, ()>> {
        self.recent_lock
            .lock()
            .map_err(|_| StorageErrorDto::new(Reason::Unknown))
    }

    pub fn recent_list(&self) -> StorageResult<Vec<RecentDto>> {
        let _guard = self.recent_guard()?;
        recent::list(&self.app_data)
    }

    pub fn recent_add(&self, path: &Path, name: &str, project_id: &str) -> StorageResult<()> {
        let _guard = self.recent_guard()?;
        recent::add(&self.app_data, path, name, project_id, self.clock.now())
    }

    pub fn recent_remove(&self, path: &Path) -> StorageResult<()> {
        let _guard = self.recent_guard()?;
        recent::remove(&self.app_data, path)
    }

    pub fn close(&self, session: &str) -> StorageResult<()> {
        let mut sessions = self.sessions()?;
        let db = sessions
            .remove(session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
        let db::ProjectDb {
            conn,
            path,
            read_only,
        } = db;
        if let Err((conn, error)) = conn.close() {
            sessions.insert(
                session.to_owned(),
                db::ProjectDb {
                    conn,
                    path,
                    read_only,
                },
            );
            return Err(error.into());
        }
        Ok(())
    }
}

#[cfg(all(test, windows))]
mod tests {
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
}
