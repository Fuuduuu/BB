use std::{fs, io, path::Path};

use chrono::{DateTime, Utc};

pub(crate) fn export(
    log_dir: &Path,
    dest: &Path,
    version: &str,
    at: DateTime<Utc>,
) -> io::Result<()> {
    let mut report = format!(
        "PCB Kaardistaja diagnostika\nVersioon: {version}\nAeg: {}\n",
        at.to_rfc3339()
    )
    .into_bytes();
    let mut logs = Vec::new();
    match fs::read_dir(log_dir) {
        Ok(entries) => {
            for entry in entries {
                let entry = entry?;
                if entry.file_type()?.is_file()
                    && entry.path().extension().is_some_and(|ext| ext == "log")
                {
                    logs.push(entry.path());
                }
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }
    logs.sort_unstable();
    for path in logs {
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        report.extend_from_slice(format!("\n--- {name} ---\n").as_bytes());
        report.extend(fs::read(path)?);
        report.push(b'\n');
    }
    fs::write(dest, report)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_export_writes_version_and_logs() {
        let directory = tempfile::tempdir().unwrap();
        let logs = directory.path().join("logs");
        fs::create_dir(&logs).unwrap();
        fs::write(logs.join("pcbk.log"), "Aktiivne logi").unwrap();
        fs::write(logs.join("pcbk_2026-11-09.log"), "Varasem logi").unwrap();
        fs::write(logs.join("muu.txt"), "Muu fail").unwrap();
        let dest = directory.path().join("diagnostika.txt");
        let at = "2026-11-09T12:00:00Z".parse().unwrap();

        export(&logs, &dest, "1.2.3", at).unwrap();

        let report = fs::read_to_string(dest).unwrap();
        assert!(report.contains("Versioon: 1.2.3"));
        assert!(report.contains("2026-11-09T12:00:00"));
        assert!(report.contains("Aktiivne logi"));
        assert!(report.contains("Varasem logi"));
        assert!(!report.contains("Muu fail"));
    }
}
