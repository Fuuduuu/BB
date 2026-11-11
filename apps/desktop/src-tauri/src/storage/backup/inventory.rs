use super::{BackupFile, BackupKind, Reason, StorageErrorDto, StorageResult};
use chrono::{NaiveDate, NaiveDateTime};
use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::io::BufReader;
use std::path::{Component, Path, PathBuf};

const BACKUP_KEEP: usize = 5;

pub(super) fn project_dir(
    app_data: &Path,
    project_id: &str,
    create: bool,
) -> StorageResult<Option<PathBuf>> {
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

pub(super) fn full_name(name: &str) -> Option<(NaiveDate, u32)> {
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

pub(super) fn inventory(dir: &Path) -> StorageResult<Vec<BackupFile>> {
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

pub(super) fn restorable(
    files: &[BackupFile],
) -> StorageResult<Vec<(&BackupFile, Option<String>)>> {
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

pub(super) fn prune(dir: &Path) -> StorageResult<()> {
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
