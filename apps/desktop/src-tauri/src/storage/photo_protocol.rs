use super::ProjectStore;
use rusqlite::{params, OptionalExtension};

pub struct PhotoResponse {
    pub status: u16,
    pub mime: Option<String>,
    pub bytes: Vec<u8>,
    pub cache_control: &'static str,
}

impl PhotoResponse {
    fn missing() -> Self {
        Self {
            status: 404,
            mime: None,
            bytes: Vec::new(),
            cache_control: "no-store",
        }
    }
}

pub(crate) fn decode_component(encoded: &str) -> Option<String> {
    let mut decoded = Vec::with_capacity(encoded.len());
    let mut bytes = encoded.bytes();
    while let Some(byte) = bytes.next() {
        if byte == b'%' {
            let high = (bytes.next()? as char).to_digit(16)?;
            let low = (bytes.next()? as char).to_digit(16)?;
            decoded.push((high * 16 + low) as u8);
        } else {
            decoded.push(byte);
        }
    }
    String::from_utf8(decoded).ok()
}

fn route(path_and_query: &str) -> Option<(String, String, &str)> {
    let (path, query) = path_and_query.split_once('?')?;
    let variant = match query {
        "v=display" => "display",
        "v=original" => "original",
        _ => return None,
    };
    let mut segments = path.split('/');
    if !segments.next()?.is_empty() || segments.next()? != "photo" {
        return None;
    }
    let session = decode_component(segments.next()?)?;
    let id = decode_component(segments.next()?)?;
    if segments.next().is_some()
        || [&session, &id].iter().any(|part| {
            part.is_empty() || part.contains(['/', '\\', '\0']) || *part == "." || *part == ".."
        })
    {
        return None;
    }
    Some((session, id, variant))
}

impl ProjectStore {
    /// Resolve a protocol path without a WebView, exposing only the latest live
    /// storage session. Closing an unsuccessful new open restores its predecessor.
    pub fn photo_protocol(&self, path_and_query: &str) -> PhotoResponse {
        let Some((session, id, variant)) = route(path_and_query) else {
            return PhotoResponse::missing();
        };
        let Ok(sessions) = self.sessions() else {
            return PhotoResponse::missing();
        };
        let Ok(order) = self.session_order.lock() else {
            return PhotoResponse::missing();
        };
        if order.last() != Some(&session) {
            return PhotoResponse::missing();
        }
        let Some(db) = sessions.get(&session) else {
            return PhotoResponse::missing();
        };
        let selected = db.conn.query_row(
            "SELECT mime,bytes FROM photos WHERE id=?1 AND (variant=?2 OR (?2='display' AND variant='original')) ORDER BY CASE WHEN variant=?2 THEN 0 ELSE 1 END LIMIT 1",
            params![id, variant], |row| Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?)),
        ).optional();
        match selected {
            Ok(Some((mime, bytes))) if matches!(mime.as_str(), "image/jpeg" | "image/png") => {
                PhotoResponse {
                    status: 200,
                    mime: Some(mime),
                    bytes,
                    cache_control: "no-store",
                }
            }
            _ => PhotoResponse::missing(),
        }
    }
}
