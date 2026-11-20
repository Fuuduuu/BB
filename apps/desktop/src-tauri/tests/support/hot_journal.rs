use std::{
    fs,
    path::{Path, PathBuf},
    process::{self, Command},
};

const CHILD_PATH: &str = "PCBK_TEST_HOT_JOURNAL_PATH";

pub fn journal_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push("-journal");
    name.into()
}

pub fn leave_hot_journal(path: &Path) {
    let original = fs::read(path).expect("read committed synthetic project");
    let (_, module) = module_path!().split_once("::").unwrap();
    let output = Command::new(std::env::current_exe().unwrap())
        .args([
            "--ignored",
            "--exact",
            &format!("{module}::hot_journal_writer_child"),
            "--nocapture",
        ])
        .env(CHILD_PATH, path)
        .output()
        .expect("start synthetic SQLite writer");
    assert!(
        output.status.success(),
        "SQLite writer did not leave its transaction open: {}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let journal = fs::read(journal_path(path)).expect("interrupted SQLite writer left its journal");
    assert!(journal.len() > 512);
    assert_eq!(&journal[..8], b"\xd9\xd5\x05\xf9\x20\xa1\x63\xd7");
    assert!(
        fs::read(path).unwrap() != original,
        "uncommitted document page must have spilled to disk"
    );
}

#[test]
#[ignore = "invoked as a child by leave_hot_journal"]
fn hot_journal_writer_child() {
    let path = std::env::var_os(CHILD_PATH).expect("synthetic child project path");
    let db = rusqlite::Connection::open(path).unwrap();
    db.execute_batch(
        "PRAGMA journal_mode=DELETE;
         PRAGMA synchronous=FULL;
         PRAGMA locking_mode=EXCLUSIVE;
         PRAGMA cache_size=8;
         PRAGMA cache_spill=ON;
         BEGIN EXCLUSIVE;",
    )
    .unwrap();
    assert_eq!(
        db.execute(
            "UPDATE document SET json=json_set(json, '$.name', 'Uncommitted writer') WHERE id=1",
            [],
        )
        .unwrap(),
        1
    );
    db.execute_batch(
        "CREATE TABLE spill (payload BLOB);
         INSERT INTO spill VALUES (zeroblob(8388608));",
    )
    .unwrap();
    // Exit the child without closing the SQLite connection or rolling back its transaction.
    process::exit(0);
}
