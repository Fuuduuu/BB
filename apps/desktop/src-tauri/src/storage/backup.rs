use super::copy::vacuum_into;
use super::db::ProjectDb;
use super::{PendingFile, Reason, StorageErrorDto, StorageResult};
use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, SecondsFormat, TimeDelta, Utc};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::io::BufReader;
use std::path::{Component, Path, PathBuf};
use std::time::SystemTime;
use ts_rs::TS;

const BACKUP_KEEP: usize = 5;
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

fn project_dir(app_data: &Path, project_id: &str, create: bool) -> StorageResult<Option<PathBuf>> {
    let mut parts = Path::new(project_id).components();
    if !matches!(parts.next(), Some(Component::Normal(_)))
        || parts.next().is_some()
        || project_id.contains(['/', '\\', ':'])
        || project_id.ends_with(['.', ' '])
    {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    let root = app_data.join("backups");
    let dir = root.join(project_id);
    if create {
        fs::create_dir_all(&dir)?;
    }
    let dir = match dunce::canonicalize(&dir) {
        Ok(dir) => dir,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let root = dunce::canonicalize(root)?;
    if dir != root.join(project_id) {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    Ok(Some(dir))
}

fn full_name(name: &str) -> Option<(NaiveDate, u32)> {
    let (stamp, format) = name.strip_suffix(".pcbk")?.split_once("-v")?;
    if format.is_empty() || !format.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let date = match stamp.len() {
        // Keep earlier backups and document references readable.
        10 => NaiveDate::parse_from_str(stamp, "%Y-%m-%d").ok()?,
        17 => NaiveDateTime::parse_from_str(stamp, "%Y-%m-%d-%H%M%S")
            .ok()?
            .date(),
        _ => return None,
    };
    Some((date, format.parse().ok()?))
}

fn backup_kind(name: &str) -> Option<BackupKind> {
    if full_name(name).is_some() {
        return Some(BackupKind::Full);
    }
    let date = name.strip_suffix(".doc.json")?;
    if date.len() != 15 {
        return None;
    }
    NaiveDateTime::parse_from_str(date, "%Y%m%d-%H%M%S").ok()?;
    Some(BackupKind::Doc)
}

fn inventory(dir: &Path) -> StorageResult<Vec<BackupFile>> {
    let mut files = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let Ok(name) = entry.file_name().into_string() else {
            continue;
        };
        let Some(kind) = backup_kind(&name) else {
            continue;
        };
        files.push(BackupFile {
            path: entry.path(),
            name,
            kind,
            at: entry.metadata()?.modified()?,
        });
    }
    files.sort_by(|a, b| b.at.cmp(&a.at).then_with(|| b.name.cmp(&a.name)));
    Ok(files)
}

fn doc_base(path: &Path) -> StorageResult<Option<String>> {
    #[derive(Deserialize)]
    struct Base {
        base: String,
    }
    let file = BufReader::new(fs::File::open(path)?);
    match serde_json::from_reader::<_, Base>(file) {
        Ok(document) => Ok(Some(document.base)),
        Err(error) if !error.is_io() => Ok(None),
        Err(error) => Err(std::io::Error::other(error).into()),
    }
}

fn restorable(files: &[BackupFile]) -> StorageResult<Vec<(&BackupFile, Option<String>)>> {
    let full_names: HashSet<_> = files
        .iter()
        .filter(|file| file.kind == BackupKind::Full)
        .map(|file| file.name.as_str())
        .collect();
    let mut result = Vec::with_capacity(files.len());
    for file in files {
        match file.kind {
            BackupKind::Full => result.push((file, None)),
            BackupKind::Doc => {
                let base = doc_base(&file.path)?.filter(|base| full_names.contains(base.as_str()));
                if base.is_some() {
                    result.push((file, base));
                }
            }
        }
    }
    Ok(result)
}

fn prune(dir: &Path) -> StorageResult<()> {
    let files = inventory(dir)?;
    let valid = restorable(&files)?;
    let docs = valid
        .iter()
        .filter_map(|(file, base)| base.as_deref().map(|base| (*file, base)));
    let required_bases = docs
        .clone()
        .take(BACKUP_KEEP)
        .map(|(_, base)| base)
        .collect::<HashSet<_>>();
    for (file, _) in docs.skip(BACKUP_KEEP) {
        fs::remove_file(&file.path)?;
    }
    for file in files
        .iter()
        .filter(|file| file.kind == BackupKind::Full)
        .skip(BACKUP_KEEP)
        .filter(|file| !required_bases.contains(file.name.as_str()))
    {
        fs::remove_file(&file.path)?;
    }
    Ok(())
}

fn meta(db: &ProjectDb, key: &str) -> StorageResult<String> {
    Ok(db
        .conn
        .query_row("SELECT value FROM meta WHERE key=?1", [key], |row| {
            row.get(0)
        })?)
}

fn context(app_data: &Path, db: &ProjectDb) -> StorageResult<(PathBuf, u32)> {
    let project_id = meta(db, "project_id")?;
    let format = meta(db, "format_version")?
        .parse()
        .map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
    let dir = project_dir(app_data, &project_id, true)?
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
    restorable(&inventory(&dir)?)?
        .into_iter()
        .map(|(file, base)| {
            let path = file
                .path
                .to_str()
                .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
            Ok(BackupInfoDto {
                file: path.to_owned(),
                kind: file.kind,
                at: DateTime::<Utc>::from(file.at).to_rfc3339_opts(SecondsFormat::Millis, true),
                base,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_publication_does_not_replace_an_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let now = DateTime::parse_from_rfc3339("2026-11-09T08:00:00+02:00").unwrap();
        let destination = full_destination(dir.path(), 1, now);
        let pending = PendingFile::unique(&destination).unwrap();
        fs::write(pending.path(), b"new backup").unwrap();
        // Another writer can publish after this operation created its .tmp.
        fs::write(&destination, b"first backup").unwrap();
        assert!(!publish(pending, &destination, now).unwrap());
        assert_eq!(fs::read(&destination).unwrap(), b"first backup");
    }
}
