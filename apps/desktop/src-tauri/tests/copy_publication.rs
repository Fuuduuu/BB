mod common;
#[path = "support/hot_journal.rs"]
mod hot_journal;

use common::{copy_request as request, meta, read_db, Fixture};
use hot_journal::{journal_path, leave_hot_journal};
use pcbk_desktop::storage::{replace_token, CopyRequest, Reason};
use serde_json::{json, Value};
use std::{fs, path::Path};

fn named_doc(name: &str, rev: i64) -> String {
    json!({ "format_version": 1, "name": name, "rev": rev }).to_string()
}

fn reopen(f: &Fixture, path: &Path, (id, name, rev): (&str, &str, i64)) -> String {
    let reopened = f.store.open(path).unwrap();
    f.store.close(&reopened.session).unwrap();
    let document: Value = serde_json::from_str(&reopened.doc_json).unwrap();
    println!(
        "reopened {}: project_id={}, file_id={}, name={}",
        path.file_name().unwrap().to_string_lossy(),
        reopened.project_id,
        reopened.file_id,
        document["name"]
    );
    assert_eq!(reopened.project_id, id);
    assert_eq!(
        document,
        json!({ "format_version": 1, "name": name, "rev": rev })
    );
    reopened.file_id
}

#[test]
fn copy_replace_ignores_stale_journal_of_replaced_file() {
    let f = Fixture::new();
    let dest = f.path("destination.pcbk");
    let old = f
        .store
        .create(&dest, "project-copy-old", &named_doc("Vana plaat A", 0))
        .unwrap();
    f.store.close(&old.session).unwrap();
    assert_eq!(
        reopen(&f, &dest, ("project-copy-old", "Vana plaat A", 0)),
        old.file_id
    );
    leave_hot_journal(&dest);
    assert!(journal_path(&dest).exists());

    let bystander_path = f.path("bystander.pcbk");
    let bystander = f
        .store
        .create(
            &bystander_path,
            "project-copy-bystander",
            &named_doc("Kõrvaline plaat C", 0),
        )
        .unwrap();
    f.store.close(&bystander.session).unwrap();
    let bystander_bytes = fs::read(&bystander_path).unwrap();

    let source_path = f.path("source.pcbk");
    let source = f
        .store
        .create(
            &source_path,
            "project-copy-source",
            &named_doc("Lähteplaat B", 0),
        )
        .unwrap();
    let token = replace_token(&dest).unwrap().unwrap();
    let copied = f
        .store
        .copy(CopyRequest {
            replace_token: Some(&token),
            ..request(&source, &dest, &named_doc("Kopeeritud plaat B", 1))
        })
        .unwrap()
        .opened;
    for project in [&source, &copied] {
        f.store.close(&project.session).unwrap();
    }

    assert_eq!(
        reopen(&f, &dest, ("project-copy-source", "Kopeeritud plaat B", 1)),
        copied.file_id
    );
    assert_ne!(copied.file_id, old.file_id);
    assert_eq!(
        reopen(&f, &source_path, ("project-copy-source", "Lähteplaat B", 0)),
        source.file_id
    );
    assert_eq!(
        reopen(
            &f,
            &bystander_path,
            ("project-copy-bystander", "Kõrvaline plaat C", 0)
        ),
        bystander.file_id
    );
    assert_eq!(fs::read(&bystander_path).unwrap(), bystander_bytes);
    assert!(!journal_path(&dest).exists());
    assert!(!fs::read_dir(f.path("")).unwrap().any(|entry| {
        entry
            .unwrap()
            .path()
            .extension()
            .is_some_and(|ext| ext == "replaced")
    }));
}

#[test]
fn exclusive_copy_rejects_occupied_destination() {
    let f = Fixture::new();
    let source = f.create("source.pcbk");
    let dest = f.path("existing.pcbk");
    let late = f
        .store
        .create(&dest, "project-occupied", &named_doc("Hõivatud plaat", 0))
        .unwrap();
    let copy_doc = named_doc("Päästekoopia", 1);
    let exclusive = || CopyRequest {
        exclusive: true,
        ..request(&source, &dest, &copy_doc)
    };
    assert_eq!(
        f.store.copy(exclusive()).unwrap_err().reason,
        Reason::PathTaken
    );
    f.store.close(&late.session).unwrap();

    let original = fs::read(&dest).unwrap();
    assert_eq!(
        f.store.copy(exclusive()).unwrap_err().reason,
        Reason::PathTaken
    );
    assert_eq!(fs::read(&dest).unwrap(), original);
    f.store.close(&source.session).unwrap();
    assert_eq!(
        reopen(&f, &dest, ("project-occupied", "Hõivatud plaat", 0)),
        late.file_id
    );
}

#[test]
fn same_identity_copy_keeps_copied_from_project_id() {
    let f = Fixture::new();
    let original_path = f.path("original.pcbk");
    let source_path = f.path("source.pcbk");
    let same_path = f.path("same.pcbk");
    let new_path = f.path("new.pcbk");
    let original = f
        .store
        .create(
            &original_path,
            "project-provenance-root",
            &named_doc("Algne plaat", 0),
        )
        .unwrap();
    let source = f
        .store
        .copy(CopyRequest {
            project_id: "project-provenance-source",
            copied_from_project_id: Some(&original.project_id),
            ..request(&original, &source_path, &named_doc("Lähteplaat", 1))
        })
        .unwrap()
        .opened;
    f.store.close(&original.session).unwrap();
    let same = f
        .store
        .copy(request(
            &source,
            &same_path,
            &named_doc("Sama identiteet", 1),
        ))
        .unwrap()
        .opened;
    let new = f
        .store
        .copy(CopyRequest {
            project_id: "project-provenance-new",
            copied_from_project_id: Some(&source.project_id),
            ..request(&source, &new_path, &named_doc("Uus identiteet", 1))
        })
        .unwrap()
        .opened;
    for project in [&source, &same, &new] {
        f.store.close(&project.session).unwrap();
    }

    for (path, expected, file_id, provenance) in [
        (
            &original_path,
            ("project-provenance-root", "Algne plaat", 0),
            original.file_id,
            "",
        ),
        (
            &source_path,
            ("project-provenance-source", "Lähteplaat", 1),
            source.file_id,
            "project-provenance-root",
        ),
        (
            &same_path,
            ("project-provenance-source", "Sama identiteet", 1),
            same.file_id,
            "project-provenance-root",
        ),
        (
            &new_path,
            ("project-provenance-new", "Uus identiteet", 1),
            new.file_id,
            "project-provenance-source",
        ),
    ] {
        assert_eq!(reopen(&f, path, expected), file_id);
        assert_eq!(meta(&read_db(path), "copied_from_project_id"), provenance);
        println!(
            "{} copied_from_project_id={provenance:?}",
            path.file_name().unwrap().to_string_lossy()
        );
    }
}
