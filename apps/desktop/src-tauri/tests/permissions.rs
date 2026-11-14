use std::{fs, path::Path};

#[test]
fn every_invoke_command_is_permitted() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let main = fs::read_to_string(root.join("src/main.rs")).unwrap();
    let permissions = fs::read_to_string(root.join("permissions/workbench.toml")).unwrap();
    let handlers = main
        .split_once("tauri::generate_handler![")
        .expect("invoke handler list must exist")
        .1
        .split_once(']')
        .expect("invoke handler list must end")
        .0;
    let allowed = permissions
        .split_once("commands.allow = [")
        .expect("allowed command list must exist")
        .1
        .split_once(']')
        .expect("allowed command list must end")
        .0;
    let mut commands: Vec<_> = handlers
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.rsplit_once("::").unwrap().1)
        .collect();
    let mut permitted: Vec<_> = allowed
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.strip_prefix('"').unwrap().strip_suffix('"').unwrap())
        .collect();
    commands.sort_unstable();
    permitted.sort_unstable();
    assert!(
        !commands.is_empty(),
        "invoke command list must not be empty"
    );
    assert_eq!(
        commands, permitted,
        "every invoke command needs a permission, and stale permissions must be removed"
    );
}
