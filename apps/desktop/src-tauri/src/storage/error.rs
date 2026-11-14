use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub enum Reason {
    DiskFull,
    ReadOnly,
    Missing,
    Locked,
    Exists,
    NotProject,
    TooNew,
    StaleRev,
    UnsupportedImage,
    ImageTooLarge,
    CorruptImage,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub struct StorageErrorDto {
    pub reason: Reason,
    #[ts(type = "number | null")]
    pub actual_rev: Option<i64>,
}

impl StorageErrorDto {
    pub fn new(reason: Reason) -> Self {
        Self {
            reason,
            actual_rev: None,
        }
    }
}

pub type StorageResult<T> = Result<T, StorageErrorDto>;

impl From<std::io::Error> for StorageErrorDto {
    fn from(error: std::io::Error) -> Self {
        use std::io::ErrorKind;
        let reason = if cfg!(windows) && matches!(error.raw_os_error(), Some(32 | 33)) {
            Reason::Locked
        } else {
            match error.kind() {
                ErrorKind::NotFound => Reason::Missing,
                ErrorKind::PermissionDenied => Reason::ReadOnly,
                ErrorKind::StorageFull => Reason::DiskFull,
                ErrorKind::WouldBlock => Reason::Locked,
                _ => Reason::Unknown,
            }
        };
        Self::new(reason)
    }
}

impl From<rusqlite::Error> for StorageErrorDto {
    fn from(error: rusqlite::Error) -> Self {
        use rusqlite::{Error, ErrorCode};
        let reason = match error {
            Error::SqliteFailure(code, _) => match code.code {
                ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => Reason::Locked,
                ErrorCode::ReadOnly | ErrorCode::PermissionDenied => Reason::ReadOnly,
                ErrorCode::DiskFull => Reason::DiskFull,
                ErrorCode::NotADatabase | ErrorCode::DatabaseCorrupt => Reason::NotProject,
                _ => Reason::Unknown,
            },
            _ => Reason::Unknown,
        };
        Self::new(reason)
    }
}
