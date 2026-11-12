import { expect, test } from 'vitest';
import { readExifOrientation, orientationTransform } from './exif';

function jpeg(orientation: number, little: boolean): ArrayBuffer {
  const bytes = new Uint8Array(40);
  bytes.set([0xff, 0xd8, 0xff, 0xe1, 0, 34, 69, 120, 105, 102, 0, 0]);
  const view = new DataView(bytes.buffer);
  view.setUint16(12, little ? 0x4949 : 0x4d4d);
  view.setUint16(14, 42, little);
  view.setUint32(16, 8, little);
  view.setUint16(20, 1, little);
  view.setUint16(22, 0x0112, little);
  view.setUint16(24, 3, little);
  view.setUint32(26, 1, little);
  view.setUint16(30, orientation, little);
  bytes.set([0xff, 0xd9], 38);
  return bytes.buffer;
}

test('exif_reader_reads_orientation_both_byte_orders', () => {
  const transforms = [
    'none',
    'mirror',
    'rot180',
    'mirror_rot180',
    'mirror_rot270',
    'rot90',
    'mirror_rot90',
    'rot270',
  ];
  for (const little of [true, false]) {
    for (let value = 1; value <= 8; value++) {
      expect(readExifOrientation(jpeg(value, little))).toBe(value);
      expect(orientationTransform(value)).toBe(transforms[value - 1]);
    }
  }
});

test('exif_reader_ignores_png_and_missing_tag', () => {
  expect(readExifOrientation(new Uint8Array([137, 80, 78, 71]).buffer)).toBeUndefined();
  expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBeUndefined();
  expect(readExifOrientation(jpeg(9, true))).toBeUndefined();
  const truncated = jpeg(6, true).slice(0, 29);
  expect(readExifOrientation(truncated)).toBeUndefined();
  const missing = jpeg(6, false);
  new DataView(missing).setUint16(22, 0x1234);
  expect(readExifOrientation(missing)).toBeUndefined();
  expect(orientationTransform(undefined)).toBe('none');
});
