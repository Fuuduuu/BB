use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub(crate) fn default_project_path(documents: &Path, name: &str) -> io::Result<PathBuf> {
    let directory = documents.join("PCB Kaardistaja");
    fs::create_dir_all(&directory)?;
    available_project_path(&directory, name)
}

pub(crate) fn available_project_path(directory: &Path, name: &str) -> io::Result<PathBuf> {
    let directory = dunce::canonicalize(directory)?;
    let stem = safe_stem(name);
    for number in 1.. {
        let filename = if number == 1 {
            format!("{stem}.pcbk")
        } else {
            format!("{stem} ({number}).pcbk")
        };
        let path = directory.join(filename);
        match fs::symlink_metadata(&path) {
            Ok(_) => continue,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(path),
            Err(error) => return Err(error),
        }
    }
    unreachable!()
}

fn safe_stem(name: &str) -> String {
    let sanitized: String = name
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_control() || "<>:\"/\\|?*".contains(ch) {
                '_'
            } else {
                ch
            }
        })
        .collect();
    let stem = sanitized.trim_end_matches(['.', ' ']);
    if stem.is_empty() {
        return "Plaat".into();
    }

    // Windows treats these names as devices even when a file extension is present.
    let prefix = stem
        .split('.')
        .next()
        .unwrap_or(stem)
        .trim_end()
        .to_ascii_uppercase();
    let reserved = matches!(prefix.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || prefix
            .strip_prefix("COM")
            .or_else(|| prefix.strip_prefix("LPT"))
            .is_some_and(|digit| {
                matches!(
                    digit,
                    "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
                )
            });
    if reserved {
        format!("_{stem}")
    } else {
        stem.into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_project_path_sanitizes_and_deduplicates() {
        let documents = tempfile::tempdir().unwrap();
        let name = "  mõõt<>:\"/\\|?*.  ";
        let first = default_project_path(documents.path(), name).unwrap();
        assert_eq!(
            first.parent().unwrap().file_name().unwrap(),
            "PCB Kaardistaja"
        );
        assert_eq!(first.file_name().unwrap(), "mõõt_________.pcbk");
        fs::write(first, b"existing project").unwrap();

        let second = default_project_path(documents.path(), name).unwrap();
        assert_eq!(second.file_name().unwrap(), "mõõt_________ (2).pcbk");
        fs::write(second, b"second project").unwrap();

        let third = default_project_path(documents.path(), name).unwrap();
        assert_eq!(third.file_name().unwrap(), "mõõt_________ (3).pcbk");
        let reserved = default_project_path(documents.path(), "NUL").unwrap();
        assert_eq!(reserved.file_name().unwrap(), "_NUL.pcbk");
    }
}
