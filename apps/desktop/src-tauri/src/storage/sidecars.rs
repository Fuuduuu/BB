use super::{Reason, StorageErrorDto, StorageResult};
use std::{
    fs, io,
    path::{Path, PathBuf},
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
    let mut parked = Vec::new();
    let result = (|| {
        for original in sidecar_paths(destination) {
            let metadata = match fs::symlink_metadata(&original) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
                Err(error) => return Err(error.into()),
            };
            if metadata.is_dir() {
                return Err(StorageErrorDto::new(Reason::Locked));
            }
            let temporary = with_suffix(&original, &format!(".{}.replaced", uuid::Uuid::new_v4()));
            fs::rename(&original, &temporary)?;
            parked.push((original, temporary));
        }
        publish()
    })();
    for (original, temporary) in parked.into_iter().rev() {
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
    }
    result
}
