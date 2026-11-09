use super::{
    db::{document_header, ProjectDb},
    schema, JournalDto, OpenedProjectDto, PendingFile, Reason, StorageErrorDto, StorageResult,
};
use rusqlite::{params, Connection, OpenFlags, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::Path};
use ts_rs::TS;

pub struct CopyRequest<'a> {
    pub session: &'a str,
    pub dest: &'a Path,
    pub project_id: &'a str,
    pub copied_from_project_id: Option<&'a str>,
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

pub(super) fn replace_snapshot(
    tx: &Transaction<'_>,
    doc_json: &str,
    rev: i64,
    view_json: Option<&str>,
) -> StorageResult<u32> {
    let (format, document_rev) = document_header(doc_json)?;
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

pub(super) fn write(
    source: &ProjectDb,
    dest: &Path,
    request: &CopyRequest<'_>,
) -> StorageResult<bool> {
    if request.project_id.trim().is_empty() {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    let pending = PendingFile::new(dest)?;
    let from_memory = vacuum_into(source, pending.path()).is_err();
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
    let tx = conn.transaction()?;
    let format = replace_snapshot(&tx, request.doc_json, request.rev, request.view_json)?;
    let format = format.to_string();
    for (key, value) in [
        ("format_version", format.as_str()),
        ("project_id", request.project_id),
        (
            "copied_from_project_id",
            request.copied_from_project_id.unwrap_or_default(),
        ),
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
    pending.publish(dest)?;
    Ok(from_memory)
}
