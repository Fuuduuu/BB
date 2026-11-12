import type { PhotoRef } from '@pcbk/domain';

export function orientationTransform(value: number | undefined): PhotoRef['transform'] {
  const values: PhotoRef['transform'][] = [
    'none',
    'mirror',
    'rot180',
    'mirror_rot180',
    'mirror_rot270',
    'rot90',
    'mirror_rot90',
    'rot270',
  ];
  return value === undefined ? 'none' : (values[value - 1] ?? 'none');
}

/** Reads only JPEG APP1 / TIFF Orientation; malformed metadata is ignored. */
export function readExifOrientation(bytes: ArrayBuffer): number | undefined {
  const view = new DataView(bytes);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset++) !== 0xff) return;
    while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset++;
    if (offset >= view.byteLength) return;
    const marker = view.getUint8(offset++);
    if (marker === 0xda || marker === 0xd9) return;
    if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > view.byteLength) return;
    const length = view.getUint16(offset);
    const end = offset + length;
    if (length < 2 || end > view.byteLength) return;
    const start = offset + 2;
    if (
      marker === 0xe1 &&
      length >= 16 &&
      view.getUint32(start) === 0x45786966 &&
      view.getUint16(start + 4) === 0
    ) {
      const tiff = start + 6;
      const order = view.getUint16(tiff);
      if (order !== 0x4949 && order !== 0x4d4d) return;
      const little = order === 0x4949;
      if (view.getUint16(tiff + 2, little) !== 42) return;
      const directory = tiff + view.getUint32(tiff + 4, little);
      if (directory < tiff + 8 || directory + 2 > end) return;
      const count = view.getUint16(directory, little);
      if (directory + 2 + count * 12 > end) return;
      for (let i = 0; i < count; i++) {
        const entry = directory + 2 + i * 12;
        if (view.getUint16(entry, little) !== 0x0112) continue;
        if (view.getUint16(entry + 2, little) !== 3 || view.getUint32(entry + 4, little) !== 1)
          return;
        const value = view.getUint16(entry + 8, little);
        return value >= 1 && value <= 8 ? value : undefined;
      }
    }
    offset = end;
  }
}
