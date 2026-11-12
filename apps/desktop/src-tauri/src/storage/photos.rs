use super::{schema, ProjectStore, Reason, StorageErrorDto, StorageResult};
use image::{
    codecs::jpeg::JpegEncoder, imageops::FilterType, DynamicImage, ImageFormat, ImageReader,
    RgbImage,
};
use rusqlite::{params, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{fs, io::Cursor, path::Path};
use ts_rs::TS;
use zune_core::{bytestream::ZCursor, colorspace::ColorSpace, options::DecoderOptions};

const MAX_BYTES: u64 = 200_000_000;
const MAX_PIXELS: u64 = 100_000_000;
const DISPLAY_PIXELS: u64 = 12_000_000;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../../../packages/adapters/src/bindings/")]
pub struct PhotoRefDto {
    pub id: String,
    #[ts(type = "'top'")]
    pub side: String,
    pub name: String,
    pub width_px: u32,
    pub height_px: u32,
    #[ts(
        type = "'none' | 'mirror' | 'rot90' | 'rot180' | 'rot270' | 'mirror_rot90' | 'mirror_rot180' | 'mirror_rot270'"
    )]
    pub transform: String,
}

fn corrupt(_: image::ImageError) -> StorageErrorDto {
    StorageErrorDto::new(Reason::CorruptImage)
}

fn transform(bytes: &[u8]) -> &'static str {
    let orientation = exif::Reader::new()
        .read_from_container(&mut Cursor::new(bytes))
        .ok()
        .and_then(|exif| {
            exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)
                .and_then(|field| match &field.value {
                    exif::Value::Short(values) if values.len() == 1 => Some(values[0]),
                    _ => None,
                })
        });
    match orientation {
        Some(2) => "mirror",
        Some(3) => "rot180",
        Some(4) => "mirror_rot180",
        Some(5) => "mirror_rot270",
        Some(6) => "rot90",
        Some(7) => "mirror_rot90",
        Some(8) => "rot270",
        _ => "none",
    }
}

struct PreparedPhoto {
    mime: &'static str,
    width: u32,
    height: u32,
    transform: &'static str,
    display: Option<(u32, u32, Vec<u8>)>,
}

fn display_dimensions(width: u32, height: u32) -> (u32, u32) {
    let pixels = u64::from(width) * u64::from(height);
    let max_side = f64::from(u16::MAX);
    let scale = (DISPLAY_PIXELS as f64 / pixels as f64)
        .sqrt()
        .min(max_side / f64::from(width))
        .min(max_side / f64::from(height));
    let mut width = ((f64::from(width) * scale).floor() as u32).max(1);
    let mut height = ((f64::from(height) * scale).floor() as u32).max(1);
    // Rounding a very thin image up to one pixel must still honor the area cap.
    if u64::from(width) * u64::from(height) > DISPLAY_PIXELS {
        if width > height {
            width = (DISPLAY_PIXELS / u64::from(height)) as u32;
        } else {
            height = (DISPLAY_PIXELS / u64::from(width)) as u32;
        }
    }
    (width, height)
}

fn check_jpeg(bytes: &[u8]) -> StorageResult<()> {
    let corrupt = || StorageErrorDto::new(Reason::CorruptImage);
    let unsupported = || StorageErrorDto::new(Reason::UnsupportedImage);
    if !bytes.starts_with(&[0xff, 0xd8]) {
        return Err(corrupt());
    }
    let (mut position, mut frame, mut scans, mut entropy) = (2, None, 0, false);
    loop {
        if entropy {
            loop {
                let byte = *bytes.get(position).ok_or_else(corrupt)?;
                if byte != 0xff {
                    position += 1;
                    continue;
                }
                let mut next = position + 1;
                while bytes.get(next) == Some(&0xff) {
                    next += 1;
                }
                let marker = *bytes.get(next).ok_or_else(corrupt)?;
                if marker == 0 || (0xd0..=0xd7).contains(&marker) {
                    position = next + 1;
                    continue;
                }
                break;
            }
        }
        if bytes.get(position) != Some(&0xff) {
            return Err(corrupt());
        }
        while bytes.get(position) == Some(&0xff) {
            position += 1;
        }
        let marker = *bytes.get(position).ok_or_else(corrupt)?;
        position += 1;
        entropy = false;
        match marker {
            0xd9 => {
                return if frame.is_some() && scans > 0 {
                    Ok(())
                } else {
                    Err(corrupt())
                }
            }
            0x00 | 0xd8 | 0xd0..=0xd7 => return Err(corrupt()),
            0xc3 | 0xc5..=0xcf => return Err(unsupported()),
            0xc0..=0xc2 => {
                if frame.replace(marker).is_some() {
                    return Err(corrupt());
                }
            }
            0xda => {
                if frame.is_none() {
                    return Err(corrupt());
                }
                scans += 1;
                if frame != Some(0xc2) && scans > 1 {
                    return Err(unsupported());
                }
                entropy = true;
            }
            0x01 => continue,
            _ => {}
        }
        let length = bytes.get(position..position + 2).ok_or_else(corrupt)?;
        let length = usize::from(u16::from_be_bytes([length[0], length[1]]));
        if length < 2 || length > bytes.len() - position {
            return Err(corrupt());
        }
        position += length;
    }
}

fn prepare(bytes: &[u8]) -> StorageResult<PreparedPhoto> {
    let format = image::guess_format(bytes)
        .ok()
        .filter(|format| matches!(format, ImageFormat::Jpeg | ImageFormat::Png))
        .ok_or_else(|| StorageErrorDto::new(Reason::UnsupportedImage))?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err(StorageErrorDto::new(Reason::ImageTooLarge));
    }
    // Classify unsupported JPEG modes before the dimensions decoder can turn
    // its unsupported-header error into a corrupt-image result.
    if format == ImageFormat::Jpeg {
        check_jpeg(bytes)?;
    }
    let (width, height) = ImageReader::with_format(Cursor::new(bytes), format)
        .into_dimensions()
        .map_err(corrupt)?;
    let pixels = u64::from(width) * u64::from(height);
    if pixels > MAX_PIXELS {
        return Err(StorageErrorDto::new(Reason::ImageTooLarge));
    }
    if format == ImageFormat::Png && !super::photo_validation::complete_png(bytes) {
        return Err(StorageErrorDto::new(Reason::CorruptImage));
    }
    // Validate pixel data even when no display variant is needed. Dimensions and
    // byte limits above must be checked before this allocation/decoding step.
    let decoded = if format == ImageFormat::Jpeg {
        // Strict pixel decoding is additional protection; check_jpeg above
        // independently enforces the supported marker modes and EOI boundary.
        let options = DecoderOptions::default()
            .set_strict_mode(true)
            .set_max_width(usize::MAX)
            .set_max_height(usize::MAX)
            .jpeg_set_out_colorspace(ColorSpace::RGB);
        let mut decoder = zune_jpeg::JpegDecoder::new_with_options(ZCursor::new(bytes), options);
        let pixels = decoder
            .decode()
            .map_err(|_| StorageErrorDto::new(Reason::CorruptImage))?;
        DynamicImage::ImageRgb8(
            RgbImage::from_raw(width, height, pixels)
                .ok_or_else(|| StorageErrorDto::new(Reason::CorruptImage))?,
        )
    } else {
        let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
        reader.no_limits(); // The explicit 100 MP / 200 MB checks are the import limits.
        reader.decode().map_err(corrupt)?
    };
    let display = if pixels > DISPLAY_PIXELS {
        let (display_width, display_height) = display_dimensions(width, height);
        let display = decoded.resize_exact(display_width, display_height, FilterType::Triangle);
        let mut encoded = Vec::new();
        JpegEncoder::new_with_quality(&mut encoded, 90)
            .encode_image(&display.to_rgb8())
            .map_err(corrupt)?;
        Some((display_width, display_height, encoded))
    } else {
        None
    };
    Ok(PreparedPhoto {
        mime: if format == ImageFormat::Jpeg {
            "image/jpeg"
        } else {
            "image/png"
        },
        width,
        height,
        transform: transform(bytes),
        display,
    })
}

impl ProjectStore {
    pub fn import_photo_path(
        &self,
        session: &str,
        path: &Path,
        id: &str,
    ) -> StorageResult<PhotoRefDto> {
        let metadata = fs::metadata(path)?;
        if metadata.len() > MAX_BYTES {
            return Err(StorageErrorDto::new(Reason::ImageTooLarge));
        }
        let name = path
            .file_stem()
            .and_then(|name| name.to_str())
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
        self.import_photo_bytes(session, &fs::read(path)?, id, name)
    }

    pub fn import_photo_bytes(
        &self,
        session: &str,
        bytes: &[u8],
        id: &str,
        name: &str,
    ) -> StorageResult<PhotoRefDto> {
        if id.is_empty() || name.is_empty() {
            return Err(StorageErrorDto::new(Reason::Unknown));
        }
        let mut sessions = self.sessions()?;
        let db = sessions
            .get_mut(session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
        db.writable()?;
        let photo = prepare(bytes)?;
        let tx = db
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let now = schema::utc_now();
        tx.execute("INSERT INTO photos(id,variant,mime,width,height,bytes,created_at) VALUES(?1,'original',?2,?3,?4,?5,?6)",
            params![id, photo.mime, photo.width, photo.height, bytes, now])?;
        if let Some((width, height, display)) = photo.display {
            tx.execute("INSERT INTO photos(id,variant,mime,width,height,bytes,created_at) VALUES(?1,'display','image/jpeg',?2,?3,?4,?5)",
                params![id, width, height, display, now])?;
        }
        tx.execute("UPDATE meta SET value='1' WHERE key='media_dirty'", [])?;
        tx.commit()?;
        Ok(PhotoRefDto {
            id: id.into(),
            side: "top".into(),
            name: name.into(),
            width_px: photo.width,
            height_px: photo.height,
            transform: photo.transform.into(),
        })
    }

    pub fn prune_photos(&self, session: &str, keep: &[String]) -> StorageResult<()> {
        let mut sessions = self.sessions()?;
        let db = sessions
            .get_mut(session)
            .ok_or_else(|| StorageErrorDto::new(Reason::Unknown))?;
        db.writable()?;
        let tx = db
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let ids: Vec<String> = {
            let mut query = tx.prepare("SELECT DISTINCT id FROM photos")?;
            let ids = query
                .query_map([], |row| row.get(0))?
                .collect::<rusqlite::Result<_>>()?;
            ids
        };
        let mut removed = false;
        for id in ids {
            if !keep.contains(&id) {
                removed |= tx.execute("DELETE FROM photos WHERE id=?1", [&id])? > 0;
            }
        }
        if removed {
            tx.execute("UPDATE meta SET value='1' WHERE key='media_dirty'", [])?;
        }
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_dimensions_keep_extreme_aspect_ratios_under_12mp() {
        for (width, height) in [(1, 100_000_000), (100_000_000, 1), (4001, 3000)] {
            let (width, height) = display_dimensions(width, height);
            assert!(width > 0 && height > 0);
            assert!(u64::from(width) * u64::from(height) <= DISPLAY_PIXELS);
            assert!(width <= u32::from(u16::MAX) && height <= u32::from(u16::MAX));
        }
    }
}
