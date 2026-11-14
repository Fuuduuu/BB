import { expect, test } from 'vitest';
import { withExifOrientation } from './png-exif';

test('exif_writer_sets_orientation_6_and_keeps_image_data', () => {
  // JPEG headers and scan bytes must survive the insertion byte for byte.
  const jpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0, 4, 0x4a, 0x46, 0xff, 0xda, 0, 2, 17, 0xff, 0, 42, 0xff, 0xd9,
  ]);
  const original = jpeg.slice();
  const output = new Uint8Array(withExifOrientation(jpeg.buffer, 6));
  expect(Array.from(output.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe1]);
  const app1Length = (output[4]! << 8) | output[5]!;
  expect(new TextDecoder().decode(output.slice(6, 12))).toBe('Exif\0\0');
  const tiff = new DataView(output.buffer, 12, app1Length - 8);
  expect(tiff.getUint16(0, true)).toBe(0x4949);
  expect(tiff.getUint16(2, true)).toBe(42);
  const ifd = tiff.getUint32(4, true);
  expect(tiff.getUint16(ifd, true)).toBe(1);
  expect(tiff.getUint16(ifd + 2, true)).toBe(0x0112);
  expect(tiff.getUint16(ifd + 4, true)).toBe(3);
  expect(tiff.getUint32(ifd + 6, true)).toBe(1);
  expect(tiff.getUint16(ifd + 10, true)).toBe(6);
  expect(tiff.getUint32(ifd + 14, true)).toBe(0);
  expect(output.slice(4 + app1Length)).toEqual(original.slice(2));
  expect(jpeg).toEqual(original);
});
