pub(super) fn complete_png(bytes: &[u8]) -> bool {
    let mut position = 8;
    while let Some(header) = bytes.get(position..position + 8) {
        let length = u32::from_be_bytes([header[0], header[1], header[2], header[3]]) as usize;
        let Some(end) = position
            .checked_add(length)
            .and_then(|end| end.checked_add(12))
        else {
            return false;
        };
        if end > bytes.len() {
            return false;
        }
        if &header[4..8] == b"IEND" {
            return length == 0 && bytes.get(position + 8..end) == Some(&[0xae, 0x42, 0x60, 0x82]);
        }
        position = end;
    }
    false
}
