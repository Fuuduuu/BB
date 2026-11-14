use std::ops::Range;

struct Patch {
    offset: usize,
    value: [u8; 2],
    png_chunk: Option<Range<usize>>,
}

/// Plan every edit before touching the response: malformed metadata or container
/// boundaries must never leave a partially changed image. Stored blobs are not
/// borrowed here; the caller owns this response's byte buffer.
pub(super) fn neutralize(bytes: &mut [u8], mime: &str) {
    let patches = match mime {
        "image/jpeg" => jpeg_patches(bytes),
        "image/png" => png_patches(bytes),
        _ => None,
    };
    let Some(patches) = patches else { return };
    for patch in patches {
        bytes[patch.offset..patch.offset + 2].copy_from_slice(&patch.value);
        if let Some(chunk) = patch.png_chunk {
            let crc = crc32(&bytes[chunk.clone()]);
            bytes[chunk.end..chunk.end + 4].copy_from_slice(&crc.to_be_bytes());
        }
    }
}

fn orientation_patch(tiff: &[u8], start: usize) -> Result<Option<Patch>, ()> {
    // The existing import reader validates the entire EXIF payload, including
    // other fields and IFD links; this small locator only finds its inline SHORT.
    let exif = exif::Reader::new()
        .read_raw(tiff.to_vec())
        .map_err(|_| ())?;
    let Some(field) = exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY) else {
        return Ok(None);
    };
    match &field.value {
        exif::Value::Short(values) if values.len() == 1 && (1..=8).contains(&values[0]) => {}
        _ => return Err(()),
    }
    let big = match tiff.get(..4) {
        Some(b"II\x2a\0") => false,
        Some(b"MM\0\x2a") => true,
        _ => return Err(()),
    };
    let short = |offset: usize| -> Result<u16, ()> {
        let value = tiff
            .get(offset..offset.checked_add(2).ok_or(())?)
            .ok_or(())?;
        Ok(if big {
            u16::from_be_bytes([value[0], value[1]])
        } else {
            u16::from_le_bytes([value[0], value[1]])
        })
    };
    let long = |offset: usize| -> Result<u32, ()> {
        let value: [u8; 4] = tiff
            .get(offset..offset.checked_add(4).ok_or(())?)
            .ok_or(())?
            .try_into()
            .map_err(|_| ())?;
        Ok(if big {
            u32::from_be_bytes(value)
        } else {
            u32::from_le_bytes(value)
        })
    };
    let ifd = usize::try_from(long(4)?).map_err(|_| ())?;
    if ifd < 8 {
        return Err(());
    }
    let count = usize::from(short(ifd)?);
    let table = ifd.checked_add(2).ok_or(())?;
    let end = table
        .checked_add(count.checked_mul(12).ok_or(())?)
        .and_then(|end| end.checked_add(4))
        .ok_or(())?;
    if end > tiff.len() {
        return Err(());
    }
    let mut patch = None;
    for index in 0..count {
        let entry = table + index * 12; // Complete table was checked above.
        if short(entry)? != 0x0112 {
            continue;
        }
        if patch.is_some() || short(entry + 2)? != 3 || long(entry + 4)? != 1 {
            return Err(());
        }
        let value = short(entry + 8)?;
        if !(1..=8).contains(&value) {
            return Err(());
        }
        patch = Some(Patch {
            offset: start.checked_add(entry + 8).ok_or(())?,
            value: if big { [0, 1] } else { [1, 0] },
            png_chunk: None,
        });
    }
    Ok(patch.filter(|patch| tiff[patch.offset - start..patch.offset - start + 2] != patch.value))
}

fn jpeg_patches(bytes: &[u8]) -> Option<Vec<Patch>> {
    if !bytes.starts_with(&[0xff, 0xd8]) {
        return None;
    }
    let mut patches = Vec::new();
    let (mut position, mut entropy, mut frame, mut scan) = (2_usize, false, false, false);
    loop {
        if entropy {
            loop {
                let byte = *bytes.get(position)?;
                if byte != 0xff {
                    position = position.checked_add(1)?;
                    continue;
                }
                let mut next = position.checked_add(1)?;
                while bytes.get(next) == Some(&0xff) {
                    next = next.checked_add(1)?;
                }
                let marker = *bytes.get(next)?;
                if marker == 0 || (0xd0..=0xd7).contains(&marker) {
                    position = next.checked_add(1)?;
                    continue;
                }
                break;
            }
        }
        if bytes.get(position) != Some(&0xff) {
            return None;
        }
        while bytes.get(position) == Some(&0xff) {
            position = position.checked_add(1)?;
        }
        let marker = *bytes.get(position)?;
        position = position.checked_add(1)?;
        entropy = false;
        match marker {
            0xd9 => return (frame && scan).then_some(patches),
            0 | 0xd8 | 0xd0..=0xd7 => return None,
            0x01 => continue,
            0xc0..=0xc2 => frame = true,
            0xda => {
                scan = true;
                entropy = true;
            }
            _ => {}
        }
        let length = bytes.get(position..position.checked_add(2)?)?;
        let length = usize::from(u16::from_be_bytes([length[0], length[1]]));
        if length < 2 {
            return None;
        }
        let end = position.checked_add(length)?;
        let start = position.checked_add(2)?;
        let payload = bytes.get(start..end)?;
        if marker == 0xe1 && payload.starts_with(b"Exif\0\0") {
            if let Some(patch) = orientation_patch(&payload[6..], start.checked_add(6)?).ok()? {
                patches.push(patch);
            }
        }
        position = end;
    }
}

fn png_patches(bytes: &[u8]) -> Option<Vec<Patch>> {
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return None;
    }
    let (mut position, mut pixels) = (8_usize, false);
    let mut patches = Vec::new();
    loop {
        let header = bytes.get(position..position.checked_add(8)?)?;
        let length = usize::try_from(u32::from_be_bytes(header[..4].try_into().ok()?)).ok()?;
        let kind = &header[4..8];
        if position == 8 && (kind != b"IHDR" || length != 13) {
            return None;
        }
        let start = position.checked_add(8)?;
        let end = start.checked_add(length)?;
        let next = end.checked_add(4)?;
        let payload = bytes.get(start..end)?;
        let crc = bytes.get(end..next)?;
        let chunk = position.checked_add(4)?..end;
        if crc != crc32(&bytes[chunk.clone()]).to_be_bytes() {
            return None;
        }
        if kind == b"eXIf" {
            if let Some(mut patch) = orientation_patch(payload, start).ok()? {
                patch.png_chunk = Some(chunk);
                patches.push(patch);
            }
        }
        if kind == b"IDAT" {
            pixels = true;
        }
        if kind == b"IEND" {
            return (length == 0 && pixels).then_some(patches);
        }
        position = next;
    }
}

// The PNG checksum is updated in place without another dependency. A lookup
// table keeps full-container validation linear even for large original PNGs.
const CRC_TABLE: [u32; 256] = {
    let mut table = [0; 256];
    let mut index = 0;
    while index < 256 {
        let mut crc = index as u32;
        let mut bit = 0;
        while bit < 8 {
            crc = (crc >> 1) ^ (0xedb8_8320 & 0_u32.wrapping_sub(crc & 1));
            bit += 1;
        }
        table[index] = crc;
        index += 1;
    }
    table
};

fn crc32(bytes: &[u8]) -> u32 {
    !bytes.iter().fold(!0_u32, |crc, byte| {
        (crc >> 8) ^ CRC_TABLE[((crc ^ u32::from(*byte)) & 255) as usize]
    })
}
