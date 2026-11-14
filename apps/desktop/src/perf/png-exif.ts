export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Insert an EXIF-only APP1 segment without re-encoding the JPEG scan. */
export function withExifOrientation(jpeg: ArrayBuffer, orientation: ExifOrientation): ArrayBuffer {
  const source = new Uint8Array(jpeg);
  if (source[0] !== 0xff || source[1] !== 0xd8) throw new Error('Expected a JPEG SOI marker');
  if (!Number.isInteger(orientation) || orientation < 1 || orientation > 8) {
    throw new RangeError('EXIF orientation must be between 1 and 8');
  }
  const app1 = new Uint8Array(36);
  app1.set([0xff, 0xe1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  const tiff = new DataView(app1.buffer, 10);
  tiff.setUint16(0, 0x4949, true);
  tiff.setUint16(2, 42, true);
  tiff.setUint32(4, 8, true);
  tiff.setUint16(8, 1, true);
  tiff.setUint16(10, 0x0112, true);
  tiff.setUint16(12, 3, true); // TIFF SHORT
  tiff.setUint32(14, 1, true);
  tiff.setUint16(18, orientation, true);
  // The zero-filled remainder holds SHORT padding and the next-IFD offset.
  const output = new Uint8Array(source.length + app1.length);
  output.set(source.subarray(0, 2));
  output.set(app1, 2);
  output.set(source.subarray(2), 2 + app1.length);
  return output.buffer;
}
