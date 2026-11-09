use super::{absolute, PendingFile, Reason, StorageErrorDto, StorageResult};
use chrono::{DateTime, FixedOffset, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::{fs, io::ErrorKind, path::Path};
use ts_rs::TS;

const LIMIT: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub struct RecentDto {
    pub path: String,
    pub name: String,
    pub project_id: String,
    pub opened_at: String,
    pub exists: bool,
}

fn load(app_data: &Path) -> StorageResult<Vec<RecentDto>> {
    match fs::read(app_data.join("recent.json")) {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes).unwrap_or_default()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error.into()),
    }
}

fn persist(app_data: &Path, entries: &[RecentDto]) -> StorageResult<()> {
    let json = serde_json::to_vec(entries).map_err(|_| StorageErrorDto::new(Reason::Unknown))?;
    fs::create_dir_all(app_data)?;
    let target = app_data.join("recent.json");
    let pending = PendingFile::unique(&target)?;
    fs::write(pending.path(), json)?;
    pending.publish(&target)
}

fn path_string(path: &Path) -> StorageResult<String> {
    absolute(path)?
        .to_str()
        .map(str::to_owned)
        .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))
}

pub(super) fn list(app_data: &Path) -> StorageResult<Vec<RecentDto>> {
    let mut entries = load(app_data)?;
    entries.truncate(LIMIT);
    for entry in &mut entries {
        entry.exists = Path::new(&entry.path).is_file();
    }
    Ok(entries)
}

pub(super) fn add(
    app_data: &Path,
    path: &Path,
    name: &str,
    project_id: &str,
    now: DateTime<FixedOffset>,
) -> StorageResult<()> {
    let path = path_string(path)?;
    let mut entries = load(app_data)?;
    entries.retain(|entry| entry.path != path);
    entries.insert(
        0,
        RecentDto {
            exists: Path::new(&path).is_file(),
            path,
            name: name.to_owned(),
            project_id: project_id.to_owned(),
            opened_at: now
                .with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Millis, true),
        },
    );
    entries.truncate(LIMIT);
    persist(app_data, &entries)
}

pub(super) fn remove(app_data: &Path, path: &Path) -> StorageResult<()> {
    let path = path_string(path)?;
    let mut entries = load(app_data)?;
    let before = entries.len();
    entries.retain(|entry| entry.path != path);
    if entries.len() == before {
        return Ok(());
    }
    persist(app_data, &entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interrupted_recent_write_does_not_block_the_next_add() {
        let dir = tempfile::tempdir().unwrap();
        let stale = dir.path().join("recent.json.tmp");
        fs::write(&stale, b"interrupted write").unwrap();
        let path = dir.path().join("project.pcbk");
        let now = DateTime::parse_from_rfc3339("2026-11-09T12:00:00+02:00").unwrap();

        add(dir.path(), &path, "Project", "project", now).unwrap();

        let entries = list(dir.path()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].project_id, "project");
        assert_eq!(fs::read(stale).unwrap(), b"interrupted write");
    }
}
