import 'fake-indexeddb/auto';
import { entries, get, set } from 'idb-keyval';
import { afterEach, expect, test, vi } from 'vitest';
import { createWebPhotoStore } from './photos-web';
import { createWebStore } from './web-db';
import { createWebRepository } from './storage-web';
import { newBoardDoc } from '@pcbk/domain';

let sequence = 0;
function png(width = 1, height = 1) {
  const bytes = Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4p8AAAAASUVORK5CYII=',
      'base64',
    ),
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes.buffer;
}
function setup() {
  const name = `photos-${++sequence}`;
  const store = createWebStore('photos', name);
  const lifecycle = createWebPhotoStore({ store });
  return { store, ...lifecycle, projectStore: createWebStore('projects', name) };
}
function decode(width = 1, height = 1) {
  const bitmap = { width, height, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  return bitmap;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('web_photo_import_stores_original_and_ref', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  const bitmap = decode();
  const bytes = png();
  const ref = await photos.importBytes('session', bytes, 'pho_1', 'Kleebitud foto');
  expect(ref).toEqual({
    id: 'pho_1',
    side: 'top',
    name: 'Kleebitud foto',
    widthPx: 1,
    heightPx: 1,
    transform: 'none',
  });
  const stored = await get<{ mime: string; width: number; height: number; bytes: Blob }>(
    'project/pho_1/original',
    store,
  );
  expect(stored).toMatchObject({ mime: 'image/png', width: 1, height: 1 });
  expect(await stored!.bytes.arrayBuffer()).toEqual(bytes);
  expect(await get('project/pho_1/display', store)).toBeUndefined();
  expect(photos.url('session', 'pho_1', 'display')).toBe(
    photos.url('session', 'pho_1', 'original'),
  );
  expect(bitmap.close).toHaveBeenCalledOnce();
});

test('web photo cache is warmed on open and revoked on close', async () => {
  const { store, photos, prepare, release, projectStore } = setup();
  const old = createWebRepository({ store: projectStore });
  const opened = await old.create({
    projectId: 'project',
    name: 'Board',
    doc: newBoardDoc('Board'),
  });
  await old.close(opened.session);
  await set(
    'project/pho_1/original',
    { mime: 'image/png', width: 1, height: 1, bytes: new Blob([png()]) },
    store,
  );
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  const repo = createWebRepository({ store: projectStore, photoLifecycle: { prepare, release } });
  const session = await repo.open(opened.path);
  const url = photos.url(session.session, 'pho_1', 'display');
  expect(url).toMatch(/^blob:/);
  await repo.close(session.session);
  expect(revoke).toHaveBeenCalledWith(url);
  expect(() => photos.url(session.session, 'pho_1', 'original')).toThrow();
});

test('web photo prune preserves every row and cached URL without a writer lock', async () => {
  const { store, photos, prepare } = setup();
  const value = { mime: 'image/png', width: 1, height: 1, bytes: new Blob([png()]) };
  for (const key of [
    'project/keep/original',
    'project/drop/original',
    'project/drop/display',
    'other/drop/original',
  ])
    await set(key, value, store);
  await prepare('session', 'project');
  const dropped = photos.url('session', 'drop', 'original');
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  await photos.prune('session', ['keep']);
  expect((await entries(store)).map(([key]) => key)).toEqual([
    'other/drop/original',
    'project/drop/display',
    'project/drop/original',
    'project/keep/original',
  ]);
  expect(revoke).not.toHaveBeenCalled();
  expect(photos.url('session', 'drop', 'original')).toBe(dropped);
  expect(photos.url('session', 'drop', 'display')).toMatch(/^blob:/);
});

test('web rejects unsupported, oversized and corrupt images without rows', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  decode();
  await expect(
    photos.importBytes(
      'session',
      new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 104, 101, 105, 99]).buffer,
      'heic',
      'bad',
    ),
  ).rejects.toMatchObject({ reason: 'unsupported_image' });
  await expect(
    photos.importBytes('session', png(10001, 10000), 'large', 'bad'),
  ).rejects.toMatchObject({ reason: 'image_too_large' });
  expect(createImageBitmap).not.toHaveBeenCalled();
  vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('decode'));
  await expect(photos.importBytes('session', png(), 'corrupt', 'bad')).rejects.toMatchObject({
    reason: 'corrupt_image',
  });
  expect(await entries(store)).toEqual([]);
});

test('web large photo creates a JPEG display without changing the original', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  decode(4000, 4000);
  const drawImage = vi.fn();
  const convert = vi.fn().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return { drawImage };
      }
      convertToBlob = convert;
    },
  );
  const bytes = png(4000, 4000);
  const ref = await photos.importBytes('session', bytes, 'large', 'Large');
  const display = await get<{ mime: string; width: number; height: number }>(
    'project/large/display',
    store,
  );
  expect(display!.width * display!.height).toBeLessThanOrEqual(12_000_000);
  expect(display!.mime).toBe('image/jpeg');
  expect(ref).toMatchObject({ widthPx: 4000, heightPx: 4000 });
  expect(convert).toHaveBeenCalledWith({ type: 'image/jpeg', quality: 0.9 });
  expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), { imageOrientation: 'none' });
  const original = await get<{ bytes: Blob }>('project/large/original', store);
  expect(await original!.bytes.arrayBuffer()).toEqual(bytes);
});

test('web large photo keeps original when OffscreenCanvas is unavailable', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  decode(4000, 4000);
  vi.stubGlobal('OffscreenCanvas', undefined);
  await photos.importBytes('session', png(4000, 4000), 'large', 'Large');
  expect((await entries(store)).map(([key]) => key)).toEqual(['project/large/original']);
});

test('database upgrade preserves v1 projects while adding photos', async () => {
  const name = `old-photos-${++sequence}`;
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  await new Promise<void>((resolve) => {
    const tx = database.transaction('projects', 'readwrite');
    tx.objectStore('projects').put('saved', 'legacy');
    tx.oncomplete = () => resolve();
  });
  database.close();
  expect(await get('legacy', createWebStore('projects', name))).toBe('saved');
  const store = createWebStore('photos', name);
  await set('project/photo/original', 'photo', store);
  expect(await get('project/photo/original', store)).toBe('photo');
});

test('a display write failure rolls back the original row', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  decode(4000, 4000);
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return { drawImage: vi.fn() };
      }
      async convertToBlob() {
        return new Blob(['jpeg'], { type: 'image/jpeg' });
      }
    },
  );
  const add = IDBObjectStore.prototype.add;
  let count = 0;
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
    this: IDBObjectStore,
    value,
    key,
  ) {
    if (++count === 2) throw new DOMException('quota', 'QuotaExceededError');
    return add.call(this, value, key);
  });
  await expect(
    photos.importBytes('session', png(4000, 4000), 'large', 'Large'),
  ).rejects.toMatchObject({ reason: 'disk_full' });
  expect(await entries(store)).toEqual([]);
});

test('a failed photo preparation releases the new repository session', async () => {
  const { projectStore } = setup();
  const writer = createWebRepository({ store: projectStore });
  const created = await writer.create({
    projectId: 'project',
    name: 'Board',
    doc: newBoardDoc('Board'),
  });
  await writer.close(created.session);
  const prepare = vi.fn().mockRejectedValue(new Error('read failure'));
  const release = vi.fn();
  const repository = createWebRepository({
    store: projectStore,
    photoLifecycle: { prepare, release },
  });
  await expect(repository.open(created.path)).rejects.toMatchObject({ reason: 'unknown' });
  expect(release).toHaveBeenCalledWith(prepare.mock.calls[0]![0]);
});

test('web photo keeps original with Image validation when bitmap APIs are unavailable', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  vi.stubGlobal('createImageBitmap', undefined);
  vi.stubGlobal('OffscreenCanvas', undefined);
  vi.stubGlobal(
    'Image',
    class {
      onload?: () => void;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  await photos.importBytes('session', png(4000, 4000), 'large', 'Large');
  expect((await entries(store)).map(([key]) => key)).toEqual(['project/large/original']);
  expect(photos.url('session', 'large', 'display')).toMatch(/^blob:/);
  expect(revoke).toHaveBeenCalledOnce();
});

test('closing a session during image decoding prevents a late import', async () => {
  const { store, photos, prepare, release } = setup();
  await prepare('session', 'project');
  let finish!: (bitmap: { close(): void }) => void;
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    ),
  );
  const importing = photos.importBytes('session', png(), 'late', 'Late');
  release('session');
  const close = vi.fn();
  finish({ close });
  await expect(importing).rejects.toMatchObject({ reason: 'missing' });
  expect(await entries(store)).toEqual([]);
  expect(close).toHaveBeenCalledOnce();
});

test('display rounding keeps very narrow images within twelve megapixels', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  decode(100_000_000, 1);
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return { drawImage: vi.fn() };
      }
      async convertToBlob() {
        return new Blob(['jpeg'], { type: 'image/jpeg' });
      }
    },
  );
  await photos.importBytes('session', png(100_000_000, 1), 'wide', 'Wide');
  const display = await get<{ width: number; height: number }>('project/wide/display', store);
  expect(display!.width * display!.height).toBeLessThanOrEqual(12_000_000);
  expect(display!.width).toBeGreaterThan(0);
  expect(display!.height).toBeGreaterThan(0);
});

test('unsupported bitmap options fall back to Image validation and original only', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockRejectedValue(new DOMException('unsupported', 'NotSupportedError')),
  );
  vi.stubGlobal(
    'Image',
    class {
      onload?: () => void;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  await photos.importBytes('session', png(4000, 4000), 'large', 'Large');
  expect((await entries(store)).map(([key]) => key)).toEqual(['project/large/original']);
});

test('unsupported canvas conversion keeps the validated original', async () => {
  const { store, photos, prepare } = setup();
  await prepare('session', 'project');
  decode(4000, 4000);
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return { drawImage: vi.fn() };
      }
      async convertToBlob() {
        throw new DOMException('unsupported', 'NotSupportedError');
      }
    },
  );
  await photos.importBytes('session', png(4000, 4000), 'large', 'Large');
  expect((await entries(store)).map(([key]) => key)).toEqual(['project/large/original']);
});
