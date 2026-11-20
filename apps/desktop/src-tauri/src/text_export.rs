use crate::storage::{Reason, StorageErrorDto};
use std::{fs, path::Path};

pub(crate) fn write_csv(path: &Path, contents: &str) -> Result<(), StorageErrorDto> {
    if !path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("csv"))
    {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    fs::write(path, contents.as_bytes()).map_err(StorageErrorDto::from)
}

#[cfg(test)]
mod tests {
    use super::{fs, write_csv, Reason, StorageErrorDto};

    #[test]
    fn text_export_writes_csv_only() {
        let dir = tempfile::tempdir().unwrap();
        let csv = dir.path().join("võrguloend.csv");
        let contents = "Võrk;Roll;Jalad\r\nMõõtevõrk;GND;U1.3\r\n";

        write_csv(&csv, contents).unwrap();
        assert_eq!(fs::read(&csv).unwrap(), contents.as_bytes());

        let txt = dir.path().join("võrguloend.txt");
        fs::write(&txt, b"existing file").unwrap();
        for path in [&txt, &dir.path().join("võrguloend")] {
            assert_eq!(
                write_csv(path, contents),
                Err(StorageErrorDto::new(Reason::Unknown))
            );
        }
        assert_eq!(fs::read(&txt).unwrap(), b"existing file");
        assert!(!dir.path().join("võrguloend").exists());
    }
}
