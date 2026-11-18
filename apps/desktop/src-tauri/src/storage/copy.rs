use super::{
    db::{document_header, supported_format, ProjectDb},
    schema, JournalDto, OpenedProjectDto, PendingFile, Reason, StorageErrorDto, StorageResult,
};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::Path};
use ts_rs::TS;

pub struct CopyRequest<'a> {
    pub session: &'a str,
    pub dest: &'a Path,
    pub project_id: &'a str,
    pub copied_from_project_id: Option<&'a str>,
    pub exclusive: bool,
    pub doc_json: &'a str,
    pub rev: i64,
    pub view_json: Option<&'a str>,
    pub journal: &'a [JournalDto],
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub struct CopyResultDto {
    pub opened: OpenedProjectDto,
    pub from_memory: bool,
}

pub(super) fn vacuum_into(source: &ProjectDb, dest: &Path) -> StorageResult<()> {
    // An unlinked file can still be readable through its SQLite handle on Unix.
    if !fs::metadata(&source.path)?.is_file() {
        return Err(StorageErrorDto::new(Reason::NotProject));
    }
    let dest = dest
        .to_str()
        .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
    source.conn.execute("VACUUM INTO ?1", [dest])?;
    Ok(())
}

fn falls_back_to_memory(error: &StorageErrorDto) -> bool {
    error.reason != Reason::DiskFull
}

pub(super) fn replace_snapshot(
    tx: &Transaction<'_>,
    doc_json: &str,
    rev: i64,
    view_json: Option<&str>,
) -> StorageResult<u32> {
    let (format, document_rev) = document_header(doc_json)?;
    supported_format(format)?;
    if rev != document_rev {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    let count = tx.execute(
        "UPDATE document SET json=?1, rev=?2, updated_at=?3 WHERE id=1",
        params![doc_json, rev, schema::utc_now()],
    )?;
    if count == 0 {
        return Err(StorageErrorDto::new(Reason::NotProject));
    }
    if let Some(view) = view_json {
        serde_json::from_str::<Value>(view).map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
        tx.execute(
            "INSERT INTO view(id,json) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET json=excluded.json",
            [view],
        )?;
    } else {
        tx.execute("DELETE FROM view WHERE id=1", [])?;
    }
    Ok(format)
}

fn copied_from_project_id(conn: &Connection) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT value FROM meta WHERE key='copied_from_project_id'",
        [],
        |row| row.get(0),
    )
    .optional()
}

fn prepare(
    source: &ProjectDb,
    dest: &Path,
    request: &CopyRequest<'_>,
) -> StorageResult<(PendingFile, bool)> {
    if request.project_id.trim().is_empty() {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    let pending = PendingFile::unique(dest)?;
    let from_memory = match vacuum_into(source, pending.path()) {
        Ok(()) => false,
        Err(error) if falls_back_to_memory(&error) => true,
        Err(error) => return Err(error),
    };
    if from_memory {
        fs::OpenOptions::new()
            .write(true)
            .truncate(true)
            .open(pending.path())?;
    }
    let mut conn = Connection::open_with_flags(
        pending.path(),
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    if from_memory {
        schema::initialize(&mut conn, request.project_id, request.doc_json)?;
    } else {
        schema::configure(&conn)?;
    }
    let provenance = match request.copied_from_project_id {
        Some(project_id) => project_id.to_owned(),
        // An unavailable source may also prevent metadata reads. Rescue the document anyway.
        None if from_memory => copied_from_project_id(&source.conn)
            .ok()
            .flatten()
            .unwrap_or_default(),
        None => copied_from_project_id(&conn)?.unwrap_or_default(),
    };
    let tx = conn.transaction()?;
    let format = replace_snapshot(&tx, request.doc_json, request.rev, request.view_json)?;
    let format = format.to_string();
    let file_id = uuid::Uuid::new_v4().to_string();
    for (key, value) in [
        ("format_version", format.as_str()),
        ("project_id", request.project_id),
        ("file_id", file_id.as_str()),
        ("copied_from_project_id", provenance.as_str()),
    ] {
        tx.execute(
            "INSERT INTO meta(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )?;
    }
    for row in request.journal {
        tx.execute(
            "INSERT INTO journal(at,kind,command_id,request_id,source,summary) VALUES(?1,?2,?3,?4,?5,?6)",
            params![row.at, row.kind, row.command_id, row.request_id, row.source, row.summary],
        )?;
    }
    tx.commit()?;
    conn.close().map_err(|(_, error)| error)?;
    ProjectDb::open(pending.path())?.describe(String::new())?;
    Ok((pending, from_memory))
}

fn publish(pending: PendingFile, dest: &Path, exclusive: bool) -> StorageResult<()> {
    if exclusive {
        pending.publish_new(dest)
    } else {
        pending.publish(dest)
    }
}

pub(super) fn write(
    source: &ProjectDb,
    dest: &Path,
    request: &CopyRequest<'_>,
) -> StorageResult<bool> {
    let (pending, from_memory) = prepare(source, dest, request)?;
    publish(pending, dest, request.exclusive)?;
    Ok(from_memory)
}

#[cfg(test)]
mod tests {
    use super::super::{ProjectStore, SystemClock};
    use super::*;
    use std::sync::Arc;

    #[test]
    fn rescue_copy_never_replaces_late_file() {
        let dir = tempfile::tempdir().unwrap();
        let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
        let original = dir.path().join("source.pcbk");
        let source_doc = r#"{"format_version":1,"rev":0,"name":"Päästetav plaat B"}"#;
        let source = store
            .create(&original, "project-rescue-source", source_doc)
            .unwrap();
        let dest =
            crate::desktop_paths::available_project_path(dir.path(), "source - paastetud").unwrap();
        let request = CopyRequest {
            session: &source.session,
            dest: &dest,
            project_id: &source.project_id,
            copied_from_project_id: None,
            exclusive: true,
            doc_json: r#"{"format_version":1,"rev":1,"name":"Päästekoopia"}"#,
            rev: 1,
            view_json: None,
            journal: &[],
        };
        let (pending, from_memory) = {
            let sessions = store.sessions().unwrap();
            prepare(sessions.get(request.session).unwrap(), &dest, &request).unwrap()
        };
        assert!(!from_memory);
        assert!(!dest.exists());
        let temporary = pending.path().to_owned();

        // A competing file arrives after the full copy was prepared and before publication.
        let late_doc = r#"{"format_version":1,"rev":0,"name":"Hiline plaat C"}"#;
        let late = store
            .create(&dest, "project-rescue-late", late_doc)
            .unwrap();
        store.close(&late.session).unwrap();
        let original_bytes = fs::read(&dest).unwrap();

        let error = publish(pending, &dest, request.exclusive).unwrap_err();
        assert_eq!(error.reason, Reason::PathTaken);
        assert!(!temporary.exists());
        assert_eq!(fs::read(&dest).unwrap(), original_bytes);
        store.close(&source.session).unwrap();
        for (path, id, file_id, doc) in [
            (&dest, "project-rescue-late", late.file_id, late_doc),
            (
                &original,
                "project-rescue-source",
                source.file_id,
                source_doc,
            ),
        ] {
            let reopened = store.open(path).unwrap();
            store.close(&reopened.session).unwrap();
            println!(
                "reopened {}: project_id={}, file_id={}, doc={}",
                path.display(),
                reopened.project_id,
                reopened.file_id,
                reopened.doc_json
            );
            assert_eq!(reopened.project_id, id);
            assert_eq!(reopened.file_id, file_id);
            assert_eq!(reopened.doc_json, doc);
        }
    }

    #[test]
    fn disk_full_does_not_fall_back_to_memory_copy() {
        let error = StorageErrorDto::from(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_FULL),
            None,
        ));
        assert_eq!(error.reason, Reason::DiskFull);
        assert!(!falls_back_to_memory(&error));
    }

    #[test]
    fn other_copy_errors_still_fall_back_to_memory_copy() {
        for reason in [
            Reason::Missing,
            Reason::NotProject,
            Reason::ReadOnly,
            Reason::Locked,
            Reason::Unknown,
        ] {
            assert!(falls_back_to_memory(&StorageErrorDto::new(reason)));
        }
    }

    #[test]
    fn replace_snapshot_rejects_newer_format_before_changing_document() {
        let mut conn = Connection::open_in_memory().unwrap();
        let original = r#"{"format_version":1,"rev":0}"#;
        schema::initialize(&mut conn, "project-board", original).unwrap();
        let future = serde_json::json!({ "format_version": u32::MAX, "rev": 1 }).to_string();
        let tx = conn.transaction().unwrap();

        let result = replace_snapshot(&tx, &future, 1, None);
        assert_eq!(result.unwrap_err().reason, Reason::TooNew);
        let stored: (String, i64) = tx
            .query_row("SELECT json, rev FROM document WHERE id=1", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();
        assert_eq!(stored, (original.to_owned(), 0));
    }
}
