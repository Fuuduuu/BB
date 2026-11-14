import { describe, expect, test } from 'vitest';
import { pickPhotoFile } from './pick-photo-file';

describe('pickPhotoFile', () => {
  test('prefers first supported image by MIME or case-insensitive extension', () => {
    const heic = new File(['h'], 'board.heic');
    const png = new File(['p'], 'board.PNG');
    expect(pickPhotoFile([heic, png, new File(['j'], 'x', { type: 'image/jpeg' })])).toBe(png);
  });
  test('passes unsupported image candidates to decoder and ignores unrelated files', () => {
    const heic = new File(['h'], 'board.HEIF');
    expect(pickPhotoFile([new File(['t'], 'notes.txt'), heic])).toBe(heic);
    expect(pickPhotoFile([new File(['p'], 'board.pcbk')])).toBeNull();
    expect(pickPhotoFile([])).toBeNull();
  });
  test('normalizes an unnamed clipboard image while preserving bytes and MIME', async () => {
    const file = pickPhotoFile({ 0: new File(['png'], '', { type: 'image/png' }), length: 1 });
    expect(file?.name).toBe('foto.png');
    expect(file?.type).toBe('image/png');
    expect(file?.size).toBe(3);
  });
});
