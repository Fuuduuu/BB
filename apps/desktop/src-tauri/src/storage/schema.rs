use super::{db::document_header, Reason, StorageErrorDto, StorageResult};
use rusqlite::{params, Connection, TransactionBehavior};

const SCHEMA: &str = "
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE document (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, rev INTEGER NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE view (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
CREATE TABLE photos (id TEXT NOT NULL, variant TEXT NOT NULL CHECK (variant IN ('original', 'display')),
 mime TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, bytes BLOB NOT NULL,
 created_at TEXT NOT NULL, PRIMARY KEY (id, variant));
CREATE TABLE attachments (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL);
CREATE TABLE journal (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, kind TEXT NOT NULL, command_id TEXT,
 request_id TEXT, source TEXT NOT NULL DEFAULT 'user', summary TEXT NOT NULL, data TEXT);
CREATE TABLE thumbnail (id INTEGER PRIMARY KEY CHECK (id = 1), png BLOB NOT NULL);
";

pub(super) fn utc_now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub(super) fn configure(conn: &Connection) -> StorageResult<()> {
    conn.busy_timeout(std::time::Duration::ZERO)?;
    conn.execute_batch("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; COMMIT;")?;
    Ok(())
}

pub(super) fn initialize(conn: &mut Connection, project_id: &str, doc: &str) -> StorageResult<()> {
    let (format, rev) = document_header(doc)?;
    if project_id.trim().is_empty() {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    configure(conn)?;
    let tx = conn.transaction_with_behavior(TransactionBehavior::Exclusive)?;
    tx.execute_batch(SCHEMA)?;
    let now = utc_now();
    for (key, value) in [
        ("format_version", format.to_string()),
        ("app_version", env!("CARGO_PKG_VERSION").to_owned()),
        ("created_at", now.clone()),
        ("project_id", project_id.to_owned()),
        ("copied_from_project_id", String::new()),
        ("media_dirty", "0".to_owned()),
    ] {
        tx.execute(
            "INSERT INTO meta(key,value) VALUES (?1,?2)",
            params![key, value],
        )?;
    }
    tx.execute(
        "INSERT INTO document(id,json,rev,updated_at) VALUES (1,?1,?2,?3)",
        params![doc, rev, now],
    )?;
    tx.commit()?;
    Ok(())
}
