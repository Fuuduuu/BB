mod db;
mod error;
mod schema;

pub use error::{Reason, StorageErrorDto, StorageResult};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
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

#[derive(Default)]
pub struct ProjectStore {
    sessions: Mutex<HashMap<String, db::ProjectDb>>,
}

struct PendingFile(Option<PathBuf>);
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
    fn sessions(&self) -> StorageResult<MutexGuard<'_, HashMap<String, db::ProjectDb>>> {
        self.sessions
            .lock()
            .map_err(|_| StorageErrorDto::new(Reason::Unknown))
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
        let path = absolute(path)?;
        if sessions.values().any(|db| db.path == path) {
            return Err(StorageErrorDto::new(Reason::Locked));
        }
        if path.exists() && fs::metadata(&path)?.permissions().readonly() {
            return Err(StorageErrorDto::new(Reason::ReadOnly));
        }
        let mut tmp = path.as_os_str().to_owned();
        tmp.push(".tmp");
        let tmp = PathBuf::from(tmp);
        let file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)?;
        let mut pending = PendingFile(Some(tmp.clone()));
        drop(file);
        {
            let mut conn = rusqlite::Connection::open_with_flags(
                &tmp,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
                    | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
            )?;
            schema::initialize(&mut conn, project_id, doc_json)?;
            conn.close()
                .map_err(|(_, error)| StorageErrorDto::from(error))?;
        }
        fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&tmp)?
            .sync_all()?;
        fs::rename(&tmp, &path)?;
        // The old temporary path no longer belongs to this operation after rename.
        pending.0 = None;
        let db = db::ProjectDb::open(&path)?;
        let session = uuid::Uuid::new_v4().to_string();
        let opened = db.describe(session.clone())?;
        sessions.insert(session, db);
        Ok(opened)
    }
    pub fn open(&self, path: &Path) -> StorageResult<OpenedProjectDto> {
        let path = absolute(path)?;
        let mut sessions = self.sessions()?;
        if sessions.values().any(|db| db.path == path) {
            return Err(StorageErrorDto::new(Reason::Locked));
        }
        let db = db::ProjectDb::open(&path)?;
        let session = uuid::Uuid::new_v4().to_string();
        let opened = db.describe(session.clone())?;
        sessions.insert(session, db);
        Ok(opened)
    }
    pub fn save(
        &self,
        session: &str,
        base_rev: i64,
        rev: i64,
        doc_json: &str,
        journal: &[JournalDto],
    ) -> StorageResult<()> {
        self.sessions()?
            .get_mut(session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?
            .save(base_rev, rev, doc_json, journal)
    }
    pub fn save_view(&self, session: &str, view_json: &str) -> StorageResult<()> {
        self.sessions()?
            .get_mut(session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?
            .save_view(view_json)
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
