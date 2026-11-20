use super::{backup, sidecars, Reason, StorageErrorDto, StorageResult};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub(super) struct PendingFile(pub(super) Option<PathBuf>);

impl PendingFile {
    pub(super) fn unique(destination: &Path) -> StorageResult<Self> {
        let mut path = destination.as_os_str().to_owned();
        path.push(format!(".{}.tmp", uuid::Uuid::new_v4()));
        let path = PathBuf::from(path);
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)?;
        Ok(Self(Some(path)))
    }

    pub(super) fn path(&self) -> &Path {
        self.0.as_deref().expect("pending file is armed")
    }

    pub(super) fn sync(&self) -> io::Result<()> {
        fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(self.path())?
            .sync_all()
    }

    pub(super) fn publish(self, destination: &Path) -> StorageResult<()> {
        self.sync()?;
        self.replace(destination, None)
    }

    pub(super) fn publish_new(self, destination: &Path) -> StorageResult<()> {
        self.sync()?;
        self.install_new(destination)
    }

    fn install_new(mut self, destination: &Path) -> StorageResult<()> {
        if sidecars::any(destination)? {
            return Err(StorageErrorDto::new(Reason::PathTaken));
        }
        match backup::install_new(&mut self, destination) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                Err(StorageErrorDto::new(Reason::PathTaken))
            }
            Err(error) => Err(error.into()),
        }
    }

    pub(super) fn publish_confirmed(self, destination: &Path, token: &str) -> StorageResult<()> {
        self.sync()?;
        let confirmed = match fs::File::open(destination) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return self.install_new(destination)
            }
            Err(error) => return Err(error.into()),
        };
        let metadata = confirmed.metadata()?;
        if !metadata.is_file() || file_marker(&metadata)? != token {
            return Err(StorageErrorDto::new(Reason::PathTaken));
        }
        require_same_file(destination, &metadata)?;
        if metadata.permissions().readonly() {
            return Err(StorageErrorDto::new(Reason::ReadOnly));
        }
        self.replace(destination, Some((&confirmed, metadata)))
    }

    fn replace(
        mut self,
        destination: &Path,
        confirmed: Option<(&fs::File, fs::Metadata)>,
    ) -> StorageResult<()> {
        let recovered = sidecars::recover_for_replace(destination)?;
        sidecars::with_parked(destination, || {
            sidecars::require_no_recovery_data(destination)?;
            if let Some((file, approved)) = confirmed {
                // Rollback may update the agreed file's size and modification time.
                let expected = if recovered {
                    file.metadata()?
                } else {
                    approved
                };
                require_same_file(destination, &expected)?;
            }
            replace_file(self.path(), destination)
        })?;
        // After rename, this operation no longer owns the temporary path.
        self.0 = None;
        Ok(())
    }
}

fn file_marker(metadata: &fs::Metadata) -> io::Result<String> {
    Ok(format!(
        "file:{}:{:?}",
        metadata.len(),
        metadata.modified()?
    ))
}

fn main_file_marker(path: &Path) -> StorageResult<Option<String>> {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => Ok(Some(file_marker(&metadata)?)),
        Ok(_) => Err(StorageErrorDto::new(Reason::PathTaken)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn require_same_file(path: &Path, confirmed: &fs::Metadata) -> StorageResult<()> {
    let expected = file_marker(confirmed)?;
    if main_file_marker(path)?.as_deref() == Some(expected.as_str()) {
        Ok(())
    } else {
        Err(StorageErrorDto::new(Reason::PathTaken))
    }
}

pub fn replace_token(path: &Path) -> StorageResult<Option<String>> {
    let marker = main_file_marker(path)?;
    if marker.is_some() {
        return Ok(marker);
    }
    // Record occupancy without granting permission to replace a future main file.
    Ok(sidecars::any(path)?.then(|| "sidecar".to_owned()))
}

fn replace_file(source: &Path, destination: &Path) -> StorageResult<()> {
    #[cfg(test)]
    super::publication_tests::before_replace(destination)?;
    let Err(error) = fs::rename(source, destination) else {
        return Ok(());
    };
    #[cfg(windows)]
    if error.kind() == io::ErrorKind::PermissionDenied {
        use std::os::windows::fs::OpenOptionsExt;

        // MoveFileEx may report access denied when the destination is open
        // without delete sharing. A DELETE-access probe distinguishes the lock.
        const DELETE_ACCESS: u32 = 0x0001_0000;
        const SHARE_ALL: u32 = 0x7;
        if let Err(probe) = fs::OpenOptions::new()
            .access_mode(DELETE_ACCESS)
            .share_mode(SHARE_ALL)
            .open(destination)
        {
            let mapped = StorageErrorDto::from(probe);
            if mapped.reason == Reason::Locked {
                return Err(mapped);
            }
        }
    }
    Err(error.into())
}

impl Drop for PendingFile {
    fn drop(&mut self) {
        if let Some(path) = &self.0 {
            let _ = fs::remove_file(path);
        }
    }
}
