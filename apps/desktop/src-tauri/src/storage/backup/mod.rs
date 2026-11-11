mod inventory;

use self::inventory::{file_dir, full_name, inventory, project_dir, prune, restorable};
use super::copy::vacuum_into;
use super::db::ProjectDb;
use super::{PendingFile, Reason, StorageErrorDto, StorageResult};
use chrono::{DateTime, FixedOffset, SecondsFormat, TimeDelta, Utc};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use ts_rs::TS;

const DOC_BACKUP_INTERVAL_MS: i64 = 1_800_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub enum BackupKind {
    Full,
    Doc,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub struct BackupInfoDto {
    pub file: String,
    pub file_id: Option<String>,
    pub kind: BackupKind,
    pub at: String,
    pub base: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub(super) struct DocumentBackup {
    pub(super) base: String,
    pub(super) rev: i64,
    pub(super) doc: Value,
    pub(super) view: Option<Value>,
}

struct BackupFile {
    path: PathBuf,
    name: String,
    kind: BackupKind,
    at: SystemTime,
}

fn meta(db: &ProjectDb, key: &str) -> StorageResult<String> {
    Ok(db
        .conn
        .query_row("SELECT value FROM meta WHERE key=?1", [key], |row| {
            row.get(0)
        })?)
}

fn context(app_data: &Path, db: &ProjectDb) -> StorageResult<(PathBuf, u32)> {
    if db.read_only {
        return Err(StorageErrorDto::new(Reason::ReadOnly));
    }
    let project_id = meta(db, "project_id")?;
    let format = meta(db, "format_version")?
        .parse()
        .map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
    let dir = file_dir(app_data, &project_id, &db.file_id, true)?
        .ok_or_else(|| StorageErrorDto::new(Reason::Missing))?;
    Ok((dir, format))
}

fn full_destination(dir: &Path, format: u32, now: DateTime<FixedOffset>) -> PathBuf {
    dir.join(format!("{}-v{format}.pcbk", now.format("%Y-%m-%d-%H%M%S")))
}

#[cfg(windows)]
pub(super) fn install_new(pending: &mut PendingFile, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileW(source: *const u16, destination: *const u16) -> i32;
    }

    let source = fs::canonicalize(pending.path())?;
    let filename = destination
        .file_name()
        .ok_or(std::io::ErrorKind::InvalidInput)?;
    let destination = source.with_file_name(filename);
    let wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain([0])
            .collect::<Vec<_>>()
    };
    let source = wide(&source);
    let destination = wide(&destination);
    // Both buffers are NUL-terminated and live through the call. MoveFileW
    // renames within this directory and fails if the destination exists.
    if unsafe { MoveFileW(source.as_ptr(), destination.as_ptr()) } == 0 {
        return Err(std::io::Error::last_os_error());
    }
    pending.0 = None;
    Ok(())
}

#[cfg(not(windows))]
pub(super) fn install_new(pending: &mut PendingFile, destination: &Path) -> std::io::Result<()> {
    // A same-directory link installs the completed file without replacing an
    // existing name. PendingFile removes the temporary name on drop.
    fs::hard_link(pending.path(), destination)
}

fn publish(
    mut pending: PendingFile,
    destination: &Path,
    now: DateTime<FixedOffset>,
) -> StorageResult<bool> {
    let file = fs::OpenOptions::new().write(true).open(pending.path())?;
    file.set_modified(SystemTime::from(now))?;
    file.sync_all()?;
    drop(file);
    match install_new(&mut pending, destination) {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn write_full(
    db: &ProjectDb,
    destination: &Path,
    now: DateTime<FixedOffset>,
) -> StorageResult<bool> {
    if destination.exists() {
        return Ok(false);
    }
    let pending = PendingFile::unique(destination)?;
    vacuum_into(db, pending.path())?;
    publish(pending, destination, now)
}

pub(super) fn daily(
    app_data: &Path,
    db: &ProjectDb,
    now: DateTime<FixedOffset>,
) -> StorageResult<()> {
    let (dir, format) = context(app_data, db)?;
    let today = (now.date_naive(), format);
    if inventory(&dir)?
        .iter()
        .any(|file| full_name(&file.name) == Some(today))
    {
        return Ok(());
    }
    if write_full(db, &full_destination(&dir, format, now), now)? {
        prune(&dir)?;
    }
    Ok(())
}

pub(super) fn migration(
    app_data: &Path,
    db: &ProjectDb,
    now: DateTime<FixedOffset>,
) -> StorageResult<()> {
    let (dir, format) = context(app_data, db)?;
    let mut filename_time = now;
    loop {
        if write_full(db, &full_destination(&dir, format, filename_time), now)? {
            return prune(&dir);
        }
        // A daily or migration backup may already occupy this second. Keep
        // the actual creation time in metadata and find the next free name.
        filename_time = filename_time
            .checked_add_signed(TimeDelta::seconds(1))
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
    }
}

pub(super) fn after_save(
    app_data: &Path,
    db: &mut ProjectDb,
    now: DateTime<FixedOffset>,
) -> StorageResult<()> {
    let (dir, format) = context(app_data, db)?;
    let files = inventory(&dir)?;
    let base = files
        .iter()
        .find(|file| full_name(&file.name).is_some_and(|(_, version)| version == format));
    let dirty = meta(db, "media_dirty")? == "1";
    let Some(base) = base.filter(|_| !dirty) else {
        let destination = full_destination(&dir, format, now);
        if !write_full(db, &destination, now)? {
            return Ok(());
        }
        if dirty {
            db.conn
                .execute("UPDATE meta SET value='0' WHERE key='media_dirty'", [])?;
        }
        return prune(&dir);
    };
    if let Some(last) = files.iter().find(|file| file.kind == BackupKind::Doc) {
        if now.signed_duration_since(DateTime::<Utc>::from(last.at))
            < TimeDelta::milliseconds(DOC_BACKUP_INTERVAL_MS)
        {
            return Ok(());
        }
    }
    let destination = dir.join(format!("{}.doc.json", now.format("%Y%m%d-%H%M%S")));
    if destination.exists() {
        // The local clock can revisit the same second during a DST transition.
        return Ok(());
    }
    let (doc, rev): (String, i64) =
        db.conn
            .query_row("SELECT json,rev FROM document WHERE id=1", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })?;
    let view: Option<String> = db
        .conn
        .query_row("SELECT json FROM view WHERE id=1", [], |row| row.get(0))
        .optional()?;
    let parse =
        |json: &str| serde_json::from_str(json).map_err(|_| StorageErrorDto::new(Reason::Unknown));
    let snapshot = DocumentBackup {
        base: base.name.clone(),
        rev,
        doc: parse(&doc)?,
        view: view.as_deref().map(parse).transpose()?,
    };
    let pending = PendingFile::unique(&destination)?;
    serde_json::to_writer(
        fs::OpenOptions::new().write(true).open(pending.path())?,
        &snapshot,
    )
    .map_err(|error| {
        error
            .io_error_kind()
            .map(|kind| StorageErrorDto::from(std::io::Error::from(kind)))
            .unwrap_or_else(|| StorageErrorDto::new(Reason::Unknown))
    })?;
    if publish(pending, &destination, now)? {
        prune(&dir)?;
    }
    Ok(())
}

pub(super) fn list(app_data: &Path, project_id: &str) -> StorageResult<Vec<BackupInfoDto>> {
    let Some(dir) = project_dir(app_data, project_id, false)? else {
        return Ok(Vec::new());
    };
    let mut groups = vec![(dir.clone(), None)];
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let Ok(id) = entry.file_name().into_string() else {
            continue;
        };
        if let Some(group) = file_dir(app_data, project_id, &id, false)? {
            groups.push((group, Some(id)));
        }
    }
    let mut result = Vec::new();
    for (dir, file_id) in groups {
        result.extend(list_group(&dir, file_id)?);
    }
    result.sort_by(|a, b| b.at.cmp(&a.at).then_with(|| b.file.cmp(&a.file)));
    Ok(result)
}

fn list_group(dir: &Path, file_id: Option<String>) -> StorageResult<Vec<BackupInfoDto>> {
    restorable(&inventory(dir)?)?
        .into_iter()
        .map(|(file, base)| {
            let path = file
                .path
                .to_str()
                .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
            Ok(BackupInfoDto {
                file: path.to_owned(),
                file_id: file_id.clone(),
                kind: file.kind,
                at: DateTime::<Utc>::from(file.at).to_rfc3339_opts(SecondsFormat::Millis, true),
                base,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests;
