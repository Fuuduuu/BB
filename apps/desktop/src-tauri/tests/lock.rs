use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread::{self, JoinHandle},
    time::Duration,
};

use pcbk_desktop::storage::{BackupKind, ProjectStore, Reason, SystemClock};
use rusqlite::Connection;
use serde_json::{json, Value};
use tempfile::TempDir;

const CHILD_TIMEOUT: Duration = Duration::from_secs(5);

/// Always reap the native child, including when an assertion or handshake fails.
struct TestWriter {
    child: Child,
    output: Receiver<Result<String, String>>,
    reader: Option<JoinHandle<()>>,
}

impl TestWriter {
    fn spawn(mode: &str, path: &Path) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_test_writer"))
            .arg(mode)
            .arg(path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("spawn native test writer");
        let stdout = child.stdout.take().expect("child stdout");
        let (sender, output) = mpsc::channel();
        let reader = thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let line = line.map_err(|error| error.to_string());
                if sender.send(line).is_err() {
                    return;
                }
            }
        });
        Self {
            child,
            output,
            reader: Some(reader),
        }
    }

    fn expect_line(&mut self, expected: &str) {
        match self.output.recv_timeout(CHILD_TIMEOUT) {
            Ok(Ok(line)) if line == expected => {}
            Ok(Ok(line)) => panic!("expected child line {expected:?}, received {line:?}"),
            Ok(Err(error)) => panic!("reading child stdout: {error}"),
            Err(error) => panic!(
                "child did not signal {expected:?}: {error}; status: {:?}",
                self.child.try_wait().expect("query child status")
            ),
        }
    }

    fn send(&mut self, command: &str) {
        let input = self.child.stdin.as_mut().expect("child stdin");
        writeln!(input, "{command}").expect("send child command");
        input.flush().expect("flush child command");
    }

    fn kill_and_wait(&mut self) {
        self.child.kill().expect("kill writer while it is running");
        self.child.wait().expect("reap killed writer");
        self.join_reader();
    }

    fn join_reader(&mut self) {
        if let Some(reader) = self.reader.take() {
            reader.join().expect("join child stdout reader");
        }
    }
}

impl Drop for TestWriter {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(reader) = self.reader.take() {
            let _ = reader.join();
        }
    }
}

fn test_store(path: &Path) -> ProjectStore {
    ProjectStore::new(
        path.parent().unwrap().join("app-data"),
        std::sync::Arc::new(SystemClock),
    )
}

fn project() -> (TempDir, PathBuf, String) {
    let directory = tempfile::tempdir().expect("temporary project directory");
    let path = directory.path().join("native-process.pcbk");
    let document = json!({"format_version": 1, "rev": 0, "name": "initial"}).to_string();
    let store = test_store(&path);
    let opened = store
        .create(&path, "native-process-project", &document)
        .expect("create synthetic project");
    store.close(&opened.session).expect("close seed session");
    (directory, path, document)
}

fn assert_integrity(connection: &Connection) {
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .expect("check SQLite integrity after native process death");
    assert_eq!(integrity, "ok");
}

#[test]
fn second_process_cannot_open_locked_file() {
    let (_directory, path, _) = project();
    let mut writer = TestWriter::spawn("hold", &path);
    writer.expect_line("READY");

    let error = test_store(&path)
        .open(&path)
        .expect_err("a second process must not open the held project");
    assert_eq!(error.reason, Reason::Locked);
}

#[test]
fn close_releases_lock() {
    let (_directory, path, _) = project();
    let mut writer = TestWriter::spawn("hold", &path);
    writer.expect_line("READY");
    let store = test_store(&path);
    assert_eq!(
        store.open(&path).expect_err("child holds the lock").reason,
        Reason::Locked
    );

    writer.send("CLOSE");
    writer.expect_line("CLOSED");
    assert!(
        writer
            .child
            .try_wait()
            .expect("query child status")
            .is_none(),
        "the child must remain alive, so process exit cannot release the lock"
    );
    let opened = store.open(&path).expect("close released the native lock");
    store
        .close(&opened.session)
        .expect("close reopened session");
}

#[test]
fn killed_writer_leaves_consistent_file() {
    // Exercise the production save path while the child keeps committing.
    let (_directory, path, _) = project();
    let mut writer = TestWriter::spawn("loop", &path);
    writer.expect_line("READY");
    writer.expect_line("SAVED 1");
    writer.expect_line("SAVED 2");
    writer.kill_and_wait();

    let store = test_store(&path);
    let opened = store
        .open(&path)
        .expect("recover project after writer death");
    let document: Value = serde_json::from_str(&opened.doc_json).expect("valid saved JSON");
    let revision = document["rev"].as_i64().expect("saved revision");
    assert!(revision >= 2);
    assert_eq!(document["name"], format!("revision-{revision}"));
    store
        .close(&opened.session)
        .expect("release recovered project");

    let connection = Connection::open(&path).expect("inspect recovered database");
    assert_integrity(&connection);
    let stored_revision: i64 = connection
        .query_row("SELECT rev FROM document WHERE id=1", [], |row| row.get(0))
        .expect("read document revision");
    assert_eq!(stored_revision, revision, "JSON and document row agree");
    let mut statement = connection
        .prepare("SELECT command_id, summary FROM journal ORDER BY seq")
        .expect("read committed journal");
    let entries: Vec<(String, String)> = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .expect("query journal")
        .collect::<Result<_, _>>()
        .expect("read journal rows");
    assert_eq!(entries.len() as i64, revision);
    for (index, (command_id, summary)) in entries.iter().enumerate() {
        let committed_revision = index + 1;
        assert_eq!(command_id, &format!("revision:{committed_revision}"));
        assert_eq!(summary, &format!("revision {committed_revision}"));
    }
    drop(statement);
    drop(connection);

    // Also kill a deterministically uncommitted, spilled transaction. This
    // covers rollback recovery even if the loop was killed between commits.
    let (_hot_directory, hot_path, initial_document) = project();
    let initial_length = std::fs::metadata(&hot_path)
        .expect("seed file metadata")
        .len();
    let mut uncommitted = TestWriter::spawn("uncommitted", &hot_path);
    uncommitted.expect_line("UNCOMMITTED");
    let journal_path = PathBuf::from(format!("{}-journal", hot_path.to_string_lossy()));
    assert!(
        std::fs::metadata(&journal_path)
            .expect("active rollback journal exists")
            .len()
            > 512,
        "the uncommitted transaction has a rollback journal on disk"
    );
    assert!(
        std::fs::metadata(&hot_path)
            .expect("spilled file metadata")
            .len()
            > initial_length,
        "the large transaction spilled dirty pages into the database"
    );
    uncommitted.kill_and_wait();

    let opened = store
        .open(&hot_path)
        .expect("roll back the interrupted transaction");
    assert_eq!(opened.doc_json, initial_document);
    store
        .close(&opened.session)
        .expect("close recovered hot project");
    let connection = Connection::open(&hot_path).expect("inspect rolled-back database");
    assert_integrity(&connection);
    let (document, revision): (String, i64) = connection
        .query_row("SELECT json, rev FROM document WHERE id=1", [], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .expect("read original document");
    assert_eq!(document, initial_document);
    assert_eq!(revision, 0);
    let journal_count: i64 = connection
        .query_row("SELECT count(*) FROM journal", [], |row| row.get(0))
        .expect("read rolled-back journal count");
    assert_eq!(journal_count, 0, "no half-committed journal row survives");
}

#[test]
fn restore_rejects_target_with_hot_journal() {
    let (_directory, path, _) = project();
    let store = test_store(&path);
    let source = store.open(&path).unwrap();
    let backup = store
        .backups(&source.project_id)
        .unwrap()
        .into_iter()
        .find(|backup| backup.kind == BackupKind::Full)
        .unwrap();
    store.close(&source.session).unwrap();
    let backup_before = fs::read(&backup.file).unwrap();

    let mut writer = TestWriter::spawn("uncommitted", &path);
    writer.expect_line("UNCOMMITTED");
    writer.kill_and_wait();
    let journal = path.with_file_name("native-process.pcbk-journal");
    let journal_before = fs::read(&journal).unwrap();
    assert!(
        journal_before.len() > 512,
        "interrupted transaction left a journal"
    );
    let dest_before = fs::read(&path).unwrap();

    let error = store
        .restore(Path::new(&backup.file), &path)
        .expect_err("restore must leave a project and its hot journal untouched");
    assert_eq!(error.reason, Reason::Exists);
    assert!(
        fs::read(&path).unwrap() == dest_before,
        "existing project changed"
    );
    assert!(
        fs::read(&journal).unwrap() == journal_before,
        "hot journal changed"
    );
    assert!(
        fs::read(&backup.file).unwrap() == backup_before,
        "backup changed"
    );

    let orphan_dest = path.with_file_name("orphan.pcbk");
    let orphan_journal = path.with_file_name("orphan.pcbk-journal");
    fs::write(&orphan_journal, &journal_before).unwrap();
    let error = store
        .restore(Path::new(&backup.file), &orphan_dest)
        .expect_err("restore must refuse a free name with an old journal");
    assert_eq!(error.reason, Reason::Exists);
    assert!(!orphan_dest.exists());
    assert!(
        fs::read(&orphan_journal).unwrap() == journal_before,
        "old journal changed"
    );
}
