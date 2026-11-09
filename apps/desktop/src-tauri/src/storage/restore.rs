use super::{
    backup::{install_new, DocumentBackup},
    copy::replace_snapshot,
    db::ProjectDb,
    OpenedProjectDto, PendingFile, Reason, StorageErrorDto, StorageResult,
};
use std::{
    fs::{self, File, OpenOptions},
    io,
    path::{Path, PathBuf},
};

mod open_guard;

const SIDECARS: [&str; 3] = ["-journal", "-wal", "-shm"];

pub(super) fn destination(path: &Path) -> StorageResult<PathBuf> {
    let path = std::path::absolute(path)?;
    let (Some(parent), Some(name)) = (path.parent(), path.file_name()) else {
        return Err(StorageErrorDto::new(Reason::Unknown));
    };
    // Preserve the selected directory entry, including a dangling symlink.
    Ok(dunce::canonicalize(parent)?.join(name))
}

fn require_absent(path: &Path) -> StorageResult<()> {
    match fs::symlink_metadata(path) {
        Ok(_) => Err(StorageErrorDto::new(Reason::Exists)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn check_sidecars(dest: &Path) -> StorageResult<()> {
    for suffix in SIDECARS {
        let mut sidecar = dest.as_os_str().to_owned();
        sidecar.push(suffix);
        require_absent(Path::new(&sidecar))?;
    }
    Ok(())
}

#[cfg(test)]
type BeforeRestoredOpen = Box<dyn FnOnce(&Path)>;

#[cfg(test)]
thread_local! {
    static BEFORE_RESTORED_OPEN: std::cell::RefCell<Option<BeforeRestoredOpen>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
fn before_restored_open(dest: &Path) {
    if let Some(hook) = BEFORE_RESTORED_OPEN.take() {
        hook(dest);
    }
}

pub(super) fn open_published(dest: &Path) -> StorageResult<(ProjectDb, OpenedProjectDto)> {
    check_sidecars(dest)?;
    open_guard::protect(|vfs| {
        #[cfg(test)]
        before_restored_open(dest);
        let result = (|| {
            let db = ProjectDb::open_using(dest, Some(vfs))?;
            let opened = db.describe(uuid::Uuid::new_v4().to_string())?;
            Ok((db, opened))
        })();
        // SQLite may have passed its own existence probe before a sidecar
        // appeared. Reject the session while the VFS still prevents recovery.
        check_sidecars(dest)?;
        result
    })
}

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
    require_absent(dest)?;
    check_sidecars(dest)?;
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

    let pending = PendingFile::unique(dest)?;
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
    publish(pending, dest)
}

fn publish(mut pending: PendingFile, dest: &Path) -> StorageResult<()> {
    pending.sync()?;
    check_sidecars(dest)?;
    match install_new(&mut pending, dest) {
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            Err(StorageErrorDto::new(Reason::Exists))
        }
        result => result.map_err(StorageErrorDto::from),
    }
}

#[cfg(test)]
mod tests {
    use super::super::{BackupKind, ProjectStore, SystemClock};
    use super::*;
    use serde_json::Value;
    use std::{cell::RefCell, rc::Rc, sync::Arc};

    #[test]
    fn restore_publication_never_replaces_a_late_destination() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("restored.pcbk");
        assert!(!dest.exists());
        let pending = PendingFile::unique(&dest).unwrap();
        fs::write(pending.path(), b"prepared restore").unwrap();
        let temporary = pending.path().to_owned();
        // A competing writer claims the name after the initial check.
        fs::write(&dest, b"late destination").unwrap();
        let error =
            publish(pending, &dest).expect_err("publication must not replace a late destination");
        assert_eq!(error, StorageErrorDto::new(Reason::Exists));
        assert_eq!(fs::read(&dest).unwrap(), b"late destination");
        assert!(!temporary.exists());
    }

    #[test]
    fn restore_leaves_published_file_when_sidecar_appears_before_open() {
        let dir = tempfile::tempdir().unwrap();
        let store = super::super::ProjectStore::new(
            dir.path().join("app-data"),
            std::sync::Arc::new(super::super::SystemClock),
        );
        let source = dir.path().join("source.pcbk");
        let opened = store
            .create(&source, "synthetic", r#"{"format_version":1,"rev":0}"#)
            .unwrap();
        store.close(&opened.session).unwrap();
        let dest = dir.path().join("restored.pcbk");
        let before = fs::read(&source).unwrap();
        let pending = PendingFile::unique(&dest).unwrap();
        fs::write(pending.path(), &before).unwrap();
        publish(pending, &dest).unwrap();

        let journal = dir.path().join("restored.pcbk-journal");
        fs::write(&journal, b"late sidecar").unwrap();
        let error = open_published(&dest)
            .err()
            .expect("published restore must not open with a foreign sidecar");
        assert_eq!(error, StorageErrorDto::new(Reason::Exists));
        assert!(fs::read(&dest).unwrap() == before, "restored file changed");
        assert_eq!(fs::read(&journal).unwrap(), b"late sidecar");
    }

    #[test]
    fn restore_does_not_replay_a_hot_journal_arriving_during_open() {
        let dir = tempfile::tempdir().unwrap();
        let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
        let source = dir.path().join("source.pcbk");
        let opened = store
            .create(
                &source,
                "synthetic",
                r#"{"format_version":1,"rev":0,"name":"backup"}"#,
            )
            .unwrap();
        store.backup_full(&opened.session).unwrap();
        let backup = store
            .backups(&opened.project_id)
            .unwrap()
            .into_iter()
            .find(|backup| backup.kind == BackupKind::Full)
            .unwrap();
        store
            .save(
                &opened.session,
                0,
                1,
                r#"{"format_version":1,"rev":1,"name":"foreign journal revision"}"#,
                &[],
            )
            .unwrap();
        store.close(&opened.session).unwrap();
        let source_bytes = fs::read(&source).unwrap();
        let backup_bytes = fs::read(&backup.file).unwrap();

        // Spill an uncommitted transaction on a sacrificial copy. Copying its
        // journal to another name preserves its content without the writer lock.
        let writer_path = dir.path().join("journal-writer.pcbk");
        fs::write(&writer_path, &source_bytes).unwrap();
        let writer = rusqlite::Connection::open(&writer_path).unwrap();
        writer
            .execute_batch(
                "PRAGMA journal_mode=DELETE;
                 PRAGMA synchronous=FULL;
                 PRAGMA locking_mode=EXCLUSIVE;
                 PRAGMA cache_size=8;
                 PRAGMA cache_spill=ON;
                 BEGIN EXCLUSIVE;",
            )
            .unwrap();
        assert_eq!(
            writer
                .execute(
                    "UPDATE document SET json=?1, rev=2 WHERE id=1 AND rev=1",
                    [r#"{"format_version":1,"rev":2,"name":"uncommitted"}"#],
                )
                .unwrap(),
            1
        );
        // A later large write forces the dirty document page out of the cache.
        writer
            .execute_batch(
                "CREATE TABLE spill (payload BLOB);
                 INSERT INTO spill VALUES (zeroblob(8388608));",
            )
            .unwrap();
        let journal_bytes = fs::read(dir.path().join("journal-writer.pcbk-journal")).unwrap();
        assert!(journal_bytes.len() > 512);
        assert_eq!(&journal_bytes[..8], b"\xd9\xd5\x05\xf9\x20\xa1\x63\xd7");
        let foreign_journal = dir.path().join("foreign-journal");
        fs::write(&foreign_journal, &journal_bytes).unwrap();
        drop(writer);

        let dest = dir.path().join("restored.pcbk");
        let sidecar = dir.path().join("restored.pcbk-journal");
        let observation = Rc::new(RefCell::new(None));
        BEFORE_RESTORED_OPEN.with(|hook| {
            let observation = Rc::clone(&observation);
            let foreign_journal = foreign_journal.clone();
            let sidecar = sidecar.clone();
            hook.replace(Some(Box::new(move |published| {
                let published_bytes = fs::read(published).unwrap();
                fs::copy(&foreign_journal, &sidecar).expect("place hot journal during open");
                observation.replace(Some(published_bytes));
            })));
        });

        let restored = store.restore(Path::new(&backup.file), &dest);
        let published_bytes = observation
            .borrow_mut()
            .take()
            .expect("the restore must reach the insertion point");
        let error = match restored {
            Err(error) => error,
            Ok(opened) => {
                let document: Value = serde_json::from_str(&opened.doc_json).unwrap();
                panic!(
                    "restore opened revision {} after inserting a hot journal (journal remains: {})",
                    document["rev"],
                    sidecar.exists()
                );
            }
        };
        assert_eq!(error, StorageErrorDto::new(Reason::Exists));
        assert!(store.sessions().unwrap().is_empty());
        assert!(
            fs::read(&sidecar).unwrap() == journal_bytes,
            "journal changed"
        );
        assert!(
            fs::read(&dest).unwrap() == published_bytes,
            "restored file changed"
        );
        assert!(
            fs::read(&foreign_journal).unwrap() == journal_bytes,
            "source journal changed"
        );
        assert!(
            fs::read(&source).unwrap() == source_bytes,
            "original changed"
        );
        assert!(
            fs::read(&backup.file).unwrap() == backup_bytes,
            "backup changed"
        );
    }
}
