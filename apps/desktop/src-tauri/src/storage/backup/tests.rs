use super::*;

#[test]
fn backup_publication_does_not_replace_an_existing_file() {
    let dir = tempfile::tempdir().unwrap();
    let now = DateTime::parse_from_rfc3339("2026-11-09T08:00:00+02:00").unwrap();
    let destination = full_destination(dir.path(), 1, now);
    let pending = PendingFile::unique(&destination).unwrap();
    fs::write(pending.path(), b"new backup").unwrap();
    // Another writer can publish after this operation created its .tmp.
    fs::write(&destination, b"first backup").unwrap();
    assert!(!publish(pending, &destination, now).unwrap());
    assert_eq!(fs::read(&destination).unwrap(), b"first backup");
}
