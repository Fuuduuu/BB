import { StorageError } from '@pcbk/engine';

export type ImageHeader = { mime: string; width: number; height: number };
const corrupt = (): never => {
  throw new StorageError('corrupt_image');
};

/** Reads stored dimensions before any browser decoder can allocate a bitmap. */
export function imageHeader(bytes: ArrayBuffer): ImageHeader {
  const view = new DataView(bytes);
  let header: ImageHeader | undefined;
  if (
    view.byteLength >= 8 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a
  ) {
    if (view.byteLength < 33 || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452)
      corrupt();
    header = { mime: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
  } else if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset++) !== 0xff) corrupt();
      while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset++;
      if (offset >= view.byteLength) corrupt();
      const marker = view.getUint8(offset++);
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > view.byteLength) corrupt();
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > view.byteLength) corrupt();
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (length < 8) corrupt();
        header = {
          mime: 'image/jpeg',
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
        break;
      }
      offset += length;
    }
    if (!header) corrupt();
  } else {
    throw new StorageError('unsupported_image');
  }
  if (!header) return corrupt();
  if (!header.width || !header.height) return corrupt();
  if (header.width * header.height > 100_000_000 || bytes.byteLength > 200_000_000) {
    throw new StorageError('image_too_large');
  }
  return header;
}

export async function decodeImage(blob: Blob): Promise<ImageBitmap | undefined> {
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(blob, { imageOrientation: 'none' });
      } catch (error) {
        if (
          !(error instanceof TypeError) &&
          !(error instanceof DOMException && error.name === 'NotSupportedError')
        )
          throw error;
      }
    }
    if (typeof Image === 'undefined') corrupt();
    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    return undefined;
  } catch {
    return corrupt();
  }
}
