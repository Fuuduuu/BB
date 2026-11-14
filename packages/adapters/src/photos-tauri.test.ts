import { expect, test, vi } from 'vitest';
import { StorageError } from '@pcbk/engine';
import { createTauriPhotoStore, type PhotoInvoke } from './photos-tauri';

function setup(platform = 'Win32') {
  const call = vi.fn<(...args: Parameters<PhotoInvoke>) => Promise<unknown>>();
  const invoke: PhotoInvoke = <T>(...args: Parameters<PhotoInvoke>) => call(...args) as Promise<T>;
  return { call, photos: createTauriPhotoStore({ invoke, platform }) };
}

test('photo_url_uses_platform_scheme', () => {
  expect(setup().photos.url('session/1', 'pho õ', 'display')).toBe(
    'http://pcbk.localhost/photo/session%2F1/pho%20%C3%B5?v=display',
  );
  for (const platform of ['MacIntel', 'Linux x86_64']) {
    expect(setup(platform).photos.url('session', 'pho_1', 'original')).toBe(
      'pcbk://localhost/photo/session/pho_1?v=original',
    );
  }
});

test('photo bytes use raw IPC with caller identity and an encoded name', async () => {
  const { call, photos } = setup();
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const ref = {
    id: 'pho_1',
    side: 'top',
    name: 'Kleebitud foto',
    widthPx: 1,
    heightPx: 1,
    transform: 'none',
  };
  call.mockResolvedValueOnce(ref);
  expect(await photos.importBytes('session', bytes, 'pho_1', 'Kleebitud foto')).toEqual(ref);
  expect(call).toHaveBeenCalledExactlyOnceWith('photo_import_bytes', bytes, {
    headers: {
      'x-photo-session': 'session',
      'x-photo-id': 'pho_1',
      'x-photo-name': 'Kleebitud%20foto',
    },
  });
});

test('photo path and prune forward the native storage session', async () => {
  const { call, photos } = setup();
  call.mockResolvedValue(undefined);
  await photos.importPath('native', 'C:/Pildid/õ.png', 'pho_2');
  await photos.prune('native', ['pho_2']);
  expect(call.mock.calls).toEqual([
    ['photo_import_path', { session: 'native', path: 'C:/Pildid/õ.png', id: 'pho_2' }],
    ['photo_prune', { session: 'native', keep: ['pho_2'] }],
  ]);
});

test.each(['unsupported_image', 'image_too_large', 'corrupt_image'] as const)(
  'photo IPC preserves %s',
  async (reason) => {
    const { call, photos } = setup();
    call.mockRejectedValue({ reason, actual_rev: null });
    await expect(photos.importBytes('native', new ArrayBuffer(0), 'pho_1', 'Foto')).rejects.toEqual(
      new StorageError(reason),
    );
  },
);
