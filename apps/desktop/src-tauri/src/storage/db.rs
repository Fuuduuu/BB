use super::{schema, JournalDto, OpenedProjectDto, Reason, StorageErrorDto, StorageResult};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, TransactionBehavior};
use serde_json::Value;
use std::{
    ffi::CStr,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

pub(super) const MAX_JS_REV: i64 = 9_007_199_254_740_991;
const CURRENT_FORMAT_VERSION: u32 = 1;

pub(super) fn document_header(json: &str) -> StorageResult<(u32, i64)> {
    let value: Value =
        serde_json::from_str(json).map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
    let format = value
        .get("format_version")
        .and_then(Value::as_u64)
        .and_then(|v| u32::try_from(v).ok());
    let rev = value
        .get("rev")
        .and_then(Value::as_i64)
        .filter(|v| (0..=MAX_JS_REV).contains(v));
    match (format, rev) {
        (Some(format), Some(rev)) => Ok((format, rev)),
        _ => Err(StorageErrorDto::new(Reason::Unknown)),
    }
}

fn project_meta(conn: &Connection) -> StorageResult<(String, u32)> {
    let meta = || -> rusqlite::Result<(String, String)> {
        let id = conn.query_row("SELECT value FROM meta WHERE key='project_id'", [], |row| {
            row.get::<_, String>(0)
        })?;
        let format = conn.query_row(
            "SELECT value FROM meta WHERE key='format_version'",
            [],
            |row| row.get::<_, String>(0),
        )?;
        Ok((id, format))
    };
    let (id, format) = meta().map_err(|error| {
        let mapped = StorageErrorDto::from(error);
        if matches!(mapped.reason, Reason::Locked | Reason::ReadOnly) {
            mapped
        } else {
            StorageErrorDto::new(Reason::NotProject)
        }
    })?;
    let format = format
        .parse::<u32>()
        .map_err(|_| StorageErrorDto::new(Reason::NotProject))?;
    if id.is_empty() {
        return Err(StorageErrorDto::new(Reason::NotProject));
    }
    if format > CURRENT_FORMAT_VERSION {
        return Err(StorageErrorDto::new(Reason::TooNew));
    }
    Ok((id, format))
}

fn probe_uri(path: &Path) -> StorageResult<String> {
    let text = path
        .to_str()
        .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?
        .replace('\\', "/");
    let text = text.strip_prefix("//?/").unwrap_or(&text);
    let mut uri = String::from("file:");
    for byte in text.as_bytes() {
        if byte.is_ascii_alphanumeric() || b"/:-._~".contains(byte) {
            uri.push(*byte as char);
        } else {
            use std::fmt::Write;
            write!(&mut uri, "%{byte:02X}").map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
        }
    }
    uri.push_str("?immutable=1");
    Ok(uri)
}

pub(super) struct ProjectDb {
    pub conn: Connection,
    pub path: PathBuf,
    pub(super) read_only: bool,
}

impl ProjectDb {
    pub fn open(path: &Path) -> StorageResult<Self> {
        Self::open_using(path, None)
    }

    pub(super) fn open_using(path: &Path, vfs: Option<&CStr>) -> StorageResult<Self> {
        let metadata = fs::metadata(path)?;
        if !metadata.is_file() {
            return Err(StorageErrorDto::new(Reason::NotProject));
        }
        let mut header = [0u8; 16];
        let mut file = fs::File::open(path)?;
        match file.read_exact(&mut header) {
            Ok(()) if &header == b"SQLite format 3\0" => {}
            Ok(()) => return Err(StorageErrorDto::new(Reason::NotProject)),
            Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => {
                return Err(StorageErrorDto::new(Reason::NotProject))
            }
            Err(error) => return Err(error.into()),
        }
        // Immutable probing cannot recover a foreign hot journal or change its journal mode.
        // The real connection below still acquires normal SQLite locks and performs recovery.
        let probe = Connection::open_with_flags(
            probe_uri(path)?,
            OpenFlags::SQLITE_OPEN_READ_ONLY
                | OpenFlags::SQLITE_OPEN_NO_MUTEX
                | OpenFlags::SQLITE_OPEN_URI,
        )?;
        probe.busy_timeout(std::time::Duration::ZERO)?;
        project_meta(&probe)?;
        drop(probe);
        let connect = |flags| match vfs {
            Some(vfs) => Connection::open_with_flags_and_vfs(path, flags, vfs),
            None => Connection::open_with_flags(path, flags),
        };
        if metadata.permissions().readonly() {
            let conn = connect(OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
            conn.busy_timeout(std::time::Duration::ZERO)?;
            project_meta(&conn)?;
            return Ok(Self {
                conn,
                path: path.to_owned(),
                read_only: true,
            });
        }
        let conn = connect(OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
        schema::configure(&conn)?;
        project_meta(&conn)?;
        Ok(Self {
            conn,
            path: path.to_owned(),
            read_only: false,
        })
    }

    pub fn describe(&self, session: String) -> StorageResult<OpenedProjectDto> {
        let (project_id, format_version) = project_meta(&self.conn)?;
        let (doc_json, stored_rev, saved_at) = self
            .conn
            .query_row(
                "SELECT json,rev,updated_at FROM document WHERE id=1",
                [],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get(2)?)),
            )
            .map_err(|_| StorageErrorDto::new(Reason::NotProject))?;
        let (format, rev) =
            document_header(&doc_json).map_err(|_| StorageErrorDto::new(Reason::NotProject))?;
        if format != format_version || rev != stored_rev {
            return Err(StorageErrorDto::new(Reason::NotProject));
        }
        let view_json = self
            .conn
            .query_row("SELECT json FROM view WHERE id=1", [], |r| r.get(0))
            .optional()?;
        Ok(OpenedProjectDto {
            session,
            project_id,
            path: self
                .path
                .to_str()
                .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?
                .to_owned(),
            doc_json,
            view_json,
            format_version,
            read_only: self.read_only,
            saved_at,
        })
    }

    fn writable(&self) -> StorageResult<()> {
        if self.read_only || fs::metadata(&self.path)?.permissions().readonly() {
            return Err(StorageErrorDto::new(Reason::ReadOnly));
        }
        Ok(())
    }

    pub fn save(
        &mut self,
        base_rev: i64,
        rev: i64,
        doc_json: &str,
        journal: &[JournalDto],
    ) -> StorageResult<()> {
        self.writable()?;
        let (format, document_rev) = document_header(doc_json)?;
        if document_rev != rev || !(0..=MAX_JS_REV).contains(&base_rev) || rev < base_rev {
            return Err(StorageErrorDto::new(Reason::Unknown));
        }
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let count = tx.execute(
            "UPDATE document SET json=?1, rev=?2, updated_at=?3 WHERE id=1 AND rev=?4",
            params![doc_json, rev, schema::utc_now(), base_rev],
        )?;
        if count == 0 {
            let actual = tx
                .query_row("SELECT rev FROM document WHERE id=1", [], |r| r.get(0))
                .optional()?;
            return Err(StorageErrorDto {
                reason: Reason::StaleRev,
                actual_rev: actual,
            });
        }
        tx.execute(
            "UPDATE meta SET value=?1 WHERE key='format_version'",
            [format.to_string()],
        )?;
        for row in journal {
            tx.execute("INSERT INTO journal(at,kind,command_id,request_id,source,summary) VALUES(?1,?2,?3,?4,?5,?6)",params![row.at,row.kind,row.command_id,row.request_id,row.source,row.summary])?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn save_view(&mut self, view_json: &str) -> StorageResult<()> {
        self.writable()?;
        serde_json::from_str::<Value>(view_json)
            .map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
        self.conn.execute("INSERT INTO view(id,json) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET json=excluded.json",[view_json])?;
        Ok(())
    }
}
