use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde_json::Value;
use std::path::Path;

pub fn read_db(path: &Path) -> Connection {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap()
}

pub fn stored_file_id(db: &Connection) -> Option<String> {
    db.query_row("SELECT value FROM meta WHERE key='file_id'", [], |row| {
        row.get(0)
    })
    .optional()
    .unwrap()
}

pub fn pin_uids(doc: &Value) -> Vec<(&str, &str, &str)> {
    doc["components"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|component| {
            component["pins"].as_array().unwrap().iter().map(|pin| {
                (
                    component["id"].as_str().unwrap(),
                    pin["id"].as_str().unwrap(),
                    pin["uid"].as_str().unwrap(),
                )
            })
        })
        .collect()
}

pub fn photo_rows(db: &Connection) -> Vec<(String, String, Vec<u8>)> {
    db.prepare("SELECT id,variant,bytes FROM photos ORDER BY id,variant")
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}
