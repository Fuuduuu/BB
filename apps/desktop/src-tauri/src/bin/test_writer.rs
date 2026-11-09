//! Native-process fixture for lock lifetime and abrupt SQLite writer death.
use std::{
    io::{self, BufRead, Write},
    path::Path,
};

use pcbk_desktop::storage::{JournalDto, ProjectStore, SystemClock};
use rusqlite::{params, Connection};
use serde_json::{json, Value};

fn signal(message: &str) -> Result<(), String> {
    let mut stdout = io::stdout().lock();
    writeln!(stdout, "{message}").map_err(|error| error.to_string())?;
    stdout.flush().map_err(|error| error.to_string())
}

fn wait_for_command(expected: &str) -> Result<(), String> {
    let mut command = String::new();
    io::stdin()
        .lock()
        .read_line(&mut command)
        .map_err(|error| error.to_string())?;
    if command.trim_end() == expected {
        Ok(())
    } else {
        Err(format!(
            "expected command {expected:?}, received {command:?}"
        ))
    }
}

fn test_store(path: &Path) -> ProjectStore {
    let folder = path.parent().unwrap_or_else(|| Path::new("."));
    ProjectStore::new(
        folder.join("writer-app-data"),
        std::sync::Arc::new(SystemClock),
    )
}

fn hold(path: &Path) -> Result<(), String> {
    let store = test_store(path);
    let opened = store.open(path).map_err(|error| format!("{error:?}"))?;
    signal("READY")?;
    wait_for_command("CLOSE")?;
    store
        .close(&opened.session)
        .map_err(|error| format!("{error:?}"))?;
    signal("CLOSED")?;
    // Keep the process alive so the parent can prove close itself freed the lock.
    wait_for_command("EXIT")
}

fn write_loop(path: &Path) -> Result<(), String> {
    let store = test_store(path);
    let opened = store.open(path).map_err(|error| format!("{error:?}"))?;
    let document: Value =
        serde_json::from_str(&opened.doc_json).map_err(|error| error.to_string())?;
    let mut revision = document["rev"].as_i64().ok_or("missing initial revision")?;
    let payload = "x".repeat(256 * 1024);
    signal("READY")?;
    loop {
        let next_revision = revision + 1;
        let document = json!({
            "format_version": 1,
            "rev": next_revision,
            "name": format!("revision-{next_revision}"),
            "payload": payload,
        })
        .to_string();
        let journal = JournalDto {
            at: "2026-11-09T00:00:00Z".into(),
            kind: "command".into(),
            command_id: format!("revision:{next_revision}"),
            request_id: Some(format!("request-{next_revision}")),
            source: "user".into(),
            summary: format!("revision {next_revision}"),
        };
        store
            .save(
                &opened.session,
                revision,
                next_revision,
                &document,
                &[journal],
            )
            .map_err(|error| format!("{error:?}"))?;
        revision = next_revision;
        signal(&format!("SAVED {revision}"))?;
    }
}

fn uncommitted(path: &Path) -> Result<(), String> {
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "PRAGMA journal_mode=DELETE;
             PRAGMA synchronous=FULL;
             PRAGMA foreign_keys=ON;
             PRAGMA locking_mode=EXCLUSIVE;
             PRAGMA cache_size=8;
             PRAGMA cache_spill=ON;
             BEGIN EXCLUSIVE;",
        )
        .map_err(|error| error.to_string())?;
    let document = json!({
        "format_version": 1,
        "rev": 1,
        "name": "uncommitted",
        "payload": "x".repeat(8 * 1024 * 1024),
    })
    .to_string();
    let updated = connection
        .execute(
            "UPDATE document SET json=?1, rev=1, updated_at=?2 WHERE id=1 AND rev=0",
            params![document, "2026-11-09T00:00:00Z"],
        )
        .map_err(|error| error.to_string())?;
    if updated != 1 {
        return Err("uncommitted fixture requires the seeded revision 0".into());
    }
    connection
        .execute(
            "INSERT INTO journal (at, kind, command_id, request_id, source, summary)
             VALUES (?1, 'command', 'revision:1', 'request-1', 'user', 'uncommitted')",
            ["2026-11-09T00:00:00Z"],
        )
        .map_err(|error| error.to_string())?;
    // The payload greatly exceeds the eight-page cache, forcing dirty pages
    // into the database with a hot DELETE rollback journal before this signal.
    signal("UNCOMMITTED")?;
    wait_for_command("EXIT")?;
    connection
        .execute_batch("ROLLBACK;")
        .map_err(|error| error.to_string())
}

fn run() -> Result<(), String> {
    let mut arguments = std::env::args_os().skip(1);
    let mode = arguments.next().ok_or("missing writer mode")?;
    let path = arguments.next().ok_or("missing project path")?;
    if arguments.next().is_some() {
        return Err("unexpected writer argument".into());
    }
    match mode.to_str() {
        Some("hold") => hold(Path::new(&path)),
        Some("loop") => write_loop(Path::new(&path)),
        Some("uncommitted") => uncommitted(Path::new(&path)),
        _ => Err("expected hold, loop, or uncommitted writer mode".into()),
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("test_writer: {error}");
        std::process::exit(1);
    }
}
