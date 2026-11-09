use super::{
    backup::DocumentBackup, copy::replace_snapshot, db::ProjectDb, PendingFile, Reason,
    StorageErrorDto, StorageResult,
};
use std::{
    fs::{File, OpenOptions},
    io,
    path::{Path, PathBuf},
};

fn backup_path(root: &Path, path: &Path) -> StorageResult<PathBuf> {
    let path = dunce::canonicalize(path).map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
    if path == root || !path.starts_with(root) {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    Ok(path)
}

fn backup_base(root: &Path, backup: &Path, name: &str) -> StorageResult<PathBuf> {
    if name.contains(['/', '\\', ':']) || !name.ends_with(".pcbk") {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    let parent = backup
        .parent()
        .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
    let base = backup_path(root, &parent.join(name))?;
    if base.parent() != Some(parent) {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    Ok(base)
}

pub(super) fn write(app_data: &Path, backup: &Path, dest: &Path) -> StorageResult<()> {
    let root = dunce::canonicalize(app_data.join("backups"))
        .map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
    let backup = backup_path(&root, backup)?;
    let dest_parent = dest
        .parent()
        .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
    if dunce::canonicalize(dest_parent)?.starts_with(&root) {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }

    let name = backup
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
    let (base, doc) = if name.ends_with(".doc.json") {
        let doc: DocumentBackup = serde_json::from_reader(File::open(&backup)?)
            .map_err(|_| StorageErrorDto::new(Reason::NotProject))?;
        (backup_base(&root, &backup, &doc.base)?, Some(doc))
    } else if name.ends_with(".pcbk") {
        (backup, None)
    } else {
        return Err(StorageErrorDto::new(Reason::Unknown));
    };

    let pending = PendingFile::new(dest)?;
    // Write into the reserved file so read-only attributes are not copied.
    io::copy(
        &mut File::open(base)?,
        &mut OpenOptions::new().write(true).open(pending.path())?,
    )?;

    let mut db = ProjectDb::open(pending.path())?;
    let original = db.describe(String::new())?;
    if let Some(doc) = doc {
        let doc_json = doc.doc.to_string();
        let view_json = doc.view.map(|view| view.to_string());
        let tx = db.conn.transaction()?;
        let format = replace_snapshot(&tx, &doc_json, doc.rev, view_json.as_deref())?;
        if format != original.format_version {
            return Err(StorageErrorDto::new(Reason::NotProject));
        }
        tx.commit()?;
    }
    let integrity: String = db
        .conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        return Err(StorageErrorDto::new(Reason::NotProject));
    }
    drop(db);
    pending.publish(dest)
}
