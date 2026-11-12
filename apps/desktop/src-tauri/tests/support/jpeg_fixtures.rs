//! Tiny baseline JPEGs generated from zero DCT coefficients (neutral gray 128).
//! The marker, MCU, restart and padding layout follows JPEG T.81 Annexes B/F.
//! These exercise genuine entropy data, including partial edge MCUs.

#[derive(Clone, Copy)]
struct Component {
    id: u8,
    horizontal: u8,
    vertical: u8,
}

/// Generates a YCbCr baseline JPEG, either 4:4:4 or 4:2:0.
///
/// With `separate_scans`, each component has its own sequential SOS. Its MCU
/// contains one block, and edge padding is based on that component's dimensions.
pub fn fixture(
    width: u16,
    height: u16,
    subsampling420: bool,
    restart_interval: u16,
    separate_scans: bool,
) -> Vec<u8> {
    let sampling = if subsampling420 { 2 } else { 1 };
    let components = [
        Component {
            id: 1,
            horizontal: sampling,
            vertical: sampling,
        },
        Component {
            id: 2,
            horizontal: 1,
            vertical: 1,
        },
        Component {
            id: 3,
            horizontal: 1,
            vertical: 1,
        },
    ];
    baseline(width, height, &components, restart_interval, separate_scans)
}

/// Generates an 8-bit, single-component baseline JPEG.
pub fn grayscale_fixture(width: u16, height: u16, restart_interval: u16) -> Vec<u8> {
    baseline(
        width,
        height,
        &[Component {
            id: 1,
            horizontal: 1,
            vertical: 1,
        }],
        restart_interval,
        false,
    )
}

fn segment(bytes: &mut Vec<u8>, marker: u8, payload: &[u8]) {
    let length = u16::try_from(payload.len() + 2).expect("small fixture segment");
    bytes.extend_from_slice(&[0xff, marker]);
    bytes.extend_from_slice(&length.to_be_bytes());
    bytes.extend_from_slice(payload);
}

fn baseline(
    width: u16,
    height: u16,
    components: &[Component],
    restart_interval: u16,
    separate_scans: bool,
) -> Vec<u8> {
    assert!(width > 0 && height > 0);
    let mut bytes = vec![0xff, 0xd8];
    segment(&mut bytes, 0xe0, b"JFIF\0\x01\x01\0\0\x01\0\x01\0\0");

    // Quantization table zero: 64 coefficients, all divisors equal to one.
    let mut quantization = vec![0];
    quantization.extend_from_slice(&[1; 64]);
    segment(&mut bytes, 0xdb, &quantization);

    let mut frame = vec![8];
    frame.extend_from_slice(&height.to_be_bytes());
    frame.extend_from_slice(&width.to_be_bytes());
    frame.push(components.len() as u8);
    for component in components {
        frame.extend_from_slice(&[
            component.id,
            (component.horizontal << 4) | component.vertical,
            0,
        ]);
    }
    segment(&mut bytes, 0xc0, &frame);

    // Each table has one symbol with Huffman code 0 of length one:
    // DC category zero, and AC EOB. Thus each block is exactly the bits 00.
    let mut huffman = Vec::new();
    for table_class in [0x00, 0x10] {
        huffman.push(table_class);
        huffman.push(1);
        huffman.extend_from_slice(&[0; 15]);
        huffman.push(0);
    }
    segment(&mut bytes, 0xc4, &huffman);
    if restart_interval != 0 {
        segment(&mut bytes, 0xdd, &restart_interval.to_be_bytes());
    }

    let max_h = u32::from(components.iter().map(|c| c.horizontal).max().unwrap());
    let max_v = u32::from(components.iter().map(|c| c.vertical).max().unwrap());
    if separate_scans || components.len() == 1 {
        for component in components {
            let columns = (u32::from(width) * u32::from(component.horizontal)).div_ceil(8 * max_h);
            let rows = (u32::from(height) * u32::from(component.vertical)).div_ceil(8 * max_v);
            scan(
                &mut bytes,
                &[*component],
                columns * rows,
                1,
                restart_interval,
            );
        }
    } else {
        let columns = u32::from(width).div_ceil(8 * max_h);
        let rows = u32::from(height).div_ceil(8 * max_v);
        let blocks_per_mcu = components
            .iter()
            .map(|c| u32::from(c.horizontal) * u32::from(c.vertical))
            .sum();
        scan(
            &mut bytes,
            components,
            columns * rows,
            blocks_per_mcu,
            restart_interval,
        );
    }
    bytes.extend_from_slice(&[0xff, 0xd9]);
    bytes
}

fn scan(
    bytes: &mut Vec<u8>,
    components: &[Component],
    mcus: u32,
    blocks_per_mcu: u32,
    restart_interval: u16,
) {
    let mut header = vec![components.len() as u8];
    for component in components {
        header.extend_from_slice(&[component.id, 0]); // DC table 0, AC table 0.
    }
    header.extend_from_slice(&[0, 63, 0]);
    segment(bytes, 0xda, &header);

    let mut entropy = Entropy {
        bytes,
        pending: 0,
        used: 0,
    };
    let mut restart_index = 0;
    for mcu in 0..mcus {
        for _ in 0..blocks_per_mcu * 2 {
            entropy.zero();
        }
        if restart_interval != 0 && (mcu + 1) % u32::from(restart_interval) == 0 && mcu + 1 < mcus {
            entropy.pad();
            entropy
                .bytes
                .extend_from_slice(&[0xff, 0xd0 + restart_index]);
            restart_index = (restart_index + 1) % 8;
        }
    }
    entropy.pad();
}

struct Entropy<'a> {
    bytes: &'a mut Vec<u8>,
    pending: u8,
    used: u8,
}

impl Entropy<'_> {
    fn emit(&mut self) {
        self.bytes.push(self.pending);
        if self.pending == 0xff {
            self.bytes.push(0); // JPEG byte stuffing applies to entropy bytes only.
        }
        self.pending = 0;
        self.used = 0;
    }

    fn zero(&mut self) {
        self.used += 1;
        if self.used == 8 {
            self.emit();
        }
    }

    fn pad(&mut self) {
        if self.used != 0 {
            self.pending |= ((1_u16 << (8 - self.used)) - 1) as u8;
            self.emit();
        }
    }
}
