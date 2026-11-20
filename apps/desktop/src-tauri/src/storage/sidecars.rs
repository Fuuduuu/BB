use super::{Reason, StorageErrorDto, StorageResult};
use rusqlite::{Connection, OpenFlags};
use std::{
    fs, io,
    path::{Path, PathBuf},
    time::Duration,
};

pub(super) const SIDECARS: [&str; 3] = ["-journal", "-wal", "-shm"];

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(suffix);
    name.into()
}

fn sidecar_paths(destination: &Path) -> impl Iterator<Item = PathBuf> + '_ {
    SIDECARS
        .into_iter()
        .map(move |suffix| with_suffix(destination, suffix))
}

fn exists(path: &Path) -> io::Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

pub(super) fn any(destination: &Path) -> io::Result<bool> {
    for path in sidecar_paths(destination) {
        if exists(&path)? {
            return Ok(true);
        }
    }
    Ok(false)
}

pub(crate) fn occupied(destination: &Path) -> io::Result<bool> {
    Ok(exists(destination)? || any(destination)?)
}

fn has_recovery_data(destination: &Path) -> io::Result<bool> {
    Ok(
        exists(&with_suffix(destination, "-journal"))?
            || exists(&with_suffix(destination, "-wal"))?,
    )
}

pub(super) fn require_no_recovery_data(destination: &Path) -> StorageResult<()> {
    match has_recovery_data(destination) {
        Ok(false) => Ok(()),
        _ => Err(StorageErrorDto::new(Reason::Locked)),
    }
}

pub(super) fn recover_for_replace(destination: &Path) -> StorageResult<bool> {
    if !has_recovery_data(destination).map_err(|_| StorageErrorDto::new(Reason::Locked))? {
        return Ok(false);
    }
    let recovered = (|| {
        // Opening without CREATE leaves an absent main file untouched.
        let connection =
            Connection::open_with_flags(destination, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
        connection.busy_timeout(Duration::ZERO)?;
        connection.query_row("SELECT count(*) FROM sqlite_schema", [], |row| {
            row.get::<_, i64>(0)
        })?;
        connection.close().map_err(|(_, error)| error)
    })();
    recovered.map_err(|_| StorageErrorDto::new(Reason::Locked))?;
    require_no_recovery_data(destination)?;
    Ok(true)
}

fn restore(original: &Path, parked: &Path) -> io::Result<()> {
    if exists(original)? {
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "sidecar path reoccupied",
        ));
    }
    fs::rename(parked, original)
}

pub(super) fn with_parked(
    destination: &Path,
    publish: impl FnOnce() -> StorageResult<()>,
) -> StorageResult<()> {
    let original = with_suffix(destination, "-shm");
    match fs::symlink_metadata(&original) {
        Ok(metadata) if metadata.is_dir() => return Err(StorageErrorDto::new(Reason::Locked)),
        Ok(_) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => return publish(),
        Err(error) => return Err(error.into()),
    }
    let temporary = with_suffix(&original, &format!(".{}.replaced", uuid::Uuid::new_v4()));
    fs::rename(&original, &temporary)?;
    let result = publish();
    if result.is_ok() {
        if let Err(error) = fs::remove_file(&temporary) {
            log::warn!(
                "Could not remove replaced SQLite sidecar {}: {error}",
                temporary.display()
            );
        }
    } else if let Err(error) = restore(&original, &temporary) {
        // Keep the parked bytes if an independent writer claimed the original name.
        log::error!(
            "Could not restore SQLite sidecar {} from {}: {error}",
            original.display(),
            temporary.display()
        );
    }
    result
}
