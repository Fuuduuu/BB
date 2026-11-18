use super::*;
use std::{cell::Cell, rc::Rc};

#[path = "../../tests/support/hot_journal.rs"]
mod hot_journal;

const SIDE_SUFFIXES: [&str; 3] = ["-journal", "-wal", "-shm"];
type ReplaceHook = Box<dyn FnOnce(&Path) -> StorageResult<()>>;
thread_local! {
    static BEFORE_REPLACE: std::cell::RefCell<Option<ReplaceHook>> = const {
        std::cell::RefCell::new(None)
    };
}

pub(super) fn before_replace(destination: &Path) -> StorageResult<()> {
    match BEFORE_REPLACE.take() {
        Some(hook) => hook(destination),
        None => Ok(()),
    }
}

fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(suffix);
    name.into()
}

fn document(name: &str) -> String {
    serde_json::json!({ "format_version": 1, "rev": 0, "name": name }).to_string()
}

fn create_closed(store: &ProjectStore, path: &Path, id: &str, name: &str) -> String {
    let created = store.create(path, id, &document(name)).unwrap();
    store.close(&created.session).unwrap();
    created.file_id
}

fn assert_reopened(store: &ProjectStore, path: &Path, id: &str, file_id: &str, name: &str) {
    let reopened = store.open(path).unwrap();
    let actual: serde_json::Value = serde_json::from_str(&reopened.doc_json).unwrap();
    eprintln!(
        "reopened {}: project_id={}, file_id={}, name={}",
        path.file_name().unwrap().to_string_lossy(),
        reopened.project_id,
        reopened.file_id,
        actual["name"]
    );
    assert_eq!(reopened.project_id, id);
    assert_eq!(reopened.file_id, file_id);
    assert_eq!(actual["name"], name);
    store.close(&reopened.session).unwrap();
}

fn assert_no_parked_files(directory: &Path) {
    for entry in fs::read_dir(directory).unwrap() {
        let name = entry.unwrap().file_name();
        let name = name.to_string_lossy();
        assert!(
            !name.ends_with(".replaced") && !name.ends_with(".tmp"),
            "{name}"
        );
    }
}

#[test]
fn create_replace_ignores_stale_journal_of_replaced_file() {
    let dir = tempfile::tempdir().unwrap();
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
    let target = dir.path().join("replace.pcbk");
    let bystander = dir.path().join("bystander.pcbk");
    let old_id = create_closed(&store, &target, "project-a", "Original A");
    let other_id = create_closed(&store, &bystander, "project-c", "Independent C");
    hot_journal::leave_hot_journal(&target);
    for suffix in ["-wal", "-shm"] {
        fs::write(sidecar(&target, suffix), suffix.as_bytes()).unwrap();
    }

    let created = store
        .create(&target, "project-b", &document("Replacement B"))
        .unwrap();
    assert_ne!(created.file_id, old_id);
    store.close(&created.session).unwrap();
    assert_reopened(
        &store,
        &target,
        "project-b",
        &created.file_id,
        "Replacement B",
    );
    assert_reopened(&store, &bystander, "project-c", &other_id, "Independent C");
    assert!(SIDE_SUFFIXES
        .iter()
        .all(|suffix| !sidecar(&target, suffix).exists()));
    assert_no_parked_files(dir.path());
}

#[test]
fn failed_replace_puts_sidecars_back() {
    let dir = tempfile::tempdir().unwrap();
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
    let target = dir.path().join("restore-on-failure.pcbk");
    let bystander = dir.path().join("bystander.pcbk");
    let old_id = create_closed(&store, &target, "project-a", "Original A");
    let other_id = create_closed(&store, &bystander, "project-c", "Independent C");
    hot_journal::leave_hot_journal(&target);
    for suffix in ["-wal", "-shm"] {
        fs::write(sidecar(&target, suffix), suffix.as_bytes()).unwrap();
    }
    let old_file = fs::read(&target).unwrap();
    let sidecars = SIDE_SUFFIXES.map(|suffix| {
        let path = sidecar(&target, suffix);
        let contents = fs::read(&path).unwrap();
        (path, contents)
    });

    let parked_at_replace = Rc::new(Cell::new(false));
    BEFORE_REPLACE.with(|slot| {
        let parked_at_replace = Rc::clone(&parked_at_replace);
        slot.replace(Some(Box::new(move |path| {
            parked_at_replace.set(
                SIDE_SUFFIXES
                    .iter()
                    .all(|suffix| !sidecar(path, suffix).exists()),
            );
            Err(StorageErrorDto::new(Reason::Locked))
        })));
    });
    let error = store
        .create(&target, "project-b", &document("Replacement B"))
        .unwrap_err();
    assert_eq!(error.reason, Reason::Locked);
    assert!(
        fs::read(&target).unwrap() == old_file,
        "old project bytes changed"
    );
    for (path, expected) in sidecars {
        assert!(
            fs::read(&path).unwrap() == expected,
            "{} changed",
            path.display()
        );
    }
    assert_no_parked_files(dir.path());
    assert!(
        parked_at_replace.get(),
        "old sidecars were still visible when the replacement started"
    );

    // Only the rollback journal is a real SQLite file in this fixture.
    for suffix in ["-wal", "-shm"] {
        fs::remove_file(sidecar(&target, suffix)).unwrap();
    }
    assert_reopened(&store, &target, "project-a", &old_id, "Original A");
    assert_reopened(&store, &bystander, "project-c", &other_id, "Independent C");
}

#[test]
fn exclusive_publish_treats_sidecar_as_taken() {
    let dir = tempfile::tempdir().unwrap();
    let store = ProjectStore::new(dir.path().join("app-data"), Arc::new(SystemClock));
    let bystander = dir.path().join("bystander.pcbk");
    let other_id = create_closed(&store, &bystander, "project-c", "Independent C");
    let source = store
        .create(
            &dir.path().join("source.pcbk"),
            "project-b",
            &document("Copy source B"),
        )
        .unwrap();
    for suffix in SIDE_SUFFIXES {
        let stem = suffix.trim_start_matches('-');
        let target = dir.path().join(format!("{stem}.pcbk"));
        let orphan = sidecar(&target, suffix);
        if suffix == "-journal" {
            create_closed(&store, &target, "project-a", "Unrelated journal A");
            hot_journal::leave_hot_journal(&target);
            fs::remove_file(&target).unwrap();
        } else {
            fs::write(&orphan, suffix.as_bytes()).unwrap();
        }
        let before = fs::read(&orphan).unwrap();
        let next_path = crate::desktop_paths::available_project_path(dir.path(), stem).unwrap();

        let attempted =
            store.create_with_exclusive(&target, "project-b", &document("New exclusive B"), true);
        assert_eq!(attempted.unwrap_err().reason, Reason::PathTaken, "{suffix}");
        let copy = store.copy(CopyRequest {
            session: &source.session,
            dest: &target,
            project_id: &source.project_id,
            copied_from_project_id: None,
            exclusive: true,
            doc_json: &source.doc_json,
            rev: 0,
            view_json: None,
            journal: &[],
        });
        assert_eq!(copy.unwrap_err().reason, Reason::PathTaken, "{suffix}");
        assert_eq!(
            next_path.file_name().unwrap(),
            format!("{stem} (2).pcbk").as_str()
        );
        assert!(!target.exists(), "occupied main file must remain absent");
        assert!(
            fs::read(&orphan).unwrap() == before,
            "orphan sidecar changed"
        );
        let created = store
            .create_with_exclusive(&next_path, "project-b", &document("New exclusive B"), true)
            .unwrap();
        store.close(&created.session).unwrap();
        assert_reopened(
            &store,
            &next_path,
            "project-b",
            &created.file_id,
            "New exclusive B",
        );
    }
    store.close(&source.session).unwrap();
    assert_reopened(&store, &bystander, "project-c", &other_id, "Independent C");
    assert_no_parked_files(dir.path());
}
