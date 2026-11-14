import 'fake-indexeddb/auto';
import { get } from 'idb-keyval';
import { BoardDocSchema } from '@pcbk/domain';
import type { BoardDoc } from '@pcbk/domain';
import { createEngine, createProjectService } from '@pcbk/engine';
import { afterEach, expect, test, vi } from 'vitest';
import { createWebPhotoStore } from './photos-web';
import { createWebRepository } from './storage-web';
import { createWebStore } from './web-db';

afterEach(() => vi.unstubAllGlobals());

test('web_open_never_deletes_photos', async () => {
  const database = `photo-concurrent-open-${crypto.randomUUID()}`;
  const photosStore = createWebStore('photos', database);
  const projectsStore = createWebStore('projects', database);
  const clock = { now: () => '2026-11-11T12:00:00.000Z' };
  let id = 0;
  function adapter() {
    const lifecycle = createWebPhotoStore({ store: photosStore });
    let storageSession = '';
    const repo = createWebRepository({
      store: projectsStore,
      photoLifecycle: {
        async prepare(session, projectId) {
          storageSession = session;
          await lifecycle.prepare(session, projectId);
        },
        release: lifecycle.release,
      },
    });
    const { engine, host } = createEngine({
      clock,
      modules: [
        {
          id: 'test-project-owner',
          owns: BoardDocSchema.keyof().options.filter(
            (key) => key !== 'rev' && key !== 'format_version',
          ),
        },
      ],
    });
    const projects = createProjectService({
      engine,
      host,
      repo,
      clock,
      photos: lifecycle.photos,
      ids: { newId: (prefix) => `${prefix}_${++id}` },
      timing: { debounceMs: 60_000, maxWaitMs: 120_000 },
    });
    return { projects, host, photos: lifecycle.photos, session: () => storageSession };
  }
  const first = adapter();
  const second = adapter();
  const created = await first.projects.create({ name: 'Board' });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error('create failed');
  const { path, projectId } = created.value;
  try {
    expect((await first.projects.close()).ok).toBe(true);
    expect((await first.projects.open({ path })).ok).toBe(true);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }),
    );
    const bytes = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4p8AAAAASUVORK5CYII=',
        'base64',
      ),
    ).buffer;
    const photo = await first.photos.importBytes(first.session(), bytes, 'pho_pending', 'Pending');
    const current = first.host.current()!;
    // Simulate the pending reference without adding the future photo.add command.
    first.host.load(current.sessionId, { ...current.doc, photos: [photo], rev: 1 }, false);
    const before = await get<{ doc: BoardDoc }>(`project:${path}`, projectsStore);
    expect(before!.doc.photos).toEqual([]);
    const originalUrl = first.photos.url(first.session(), photo.id, 'original');

    expect((await second.projects.open({ path })).ok).toBe(true);
    const key = `${projectId}/${photo.id}/original`;
    const imported = await get<{ bytes: Blob }>(key, photosStore);
    expect(imported).toBeDefined();
    expect(await imported!.bytes.arrayBuffer()).toEqual(bytes);
    expect(first.photos.url(first.session(), photo.id, 'original')).toBe(originalUrl);
    expect(second.photos.url(second.session(), photo.id, 'display')).toMatch(/^blob:/);

    expect((await first.projects.flush()).ok).toBe(true);
    const saved = await get<{ doc: BoardDoc }>(`project:${path}`, projectsStore);
    expect(saved!.doc.photos).toEqual([photo]);
    expect(await (await get<{ bytes: Blob }>(key, photosStore))!.bytes.arrayBuffer()).toEqual(
      bytes,
    );
  } finally {
    await first.projects.discard();
    await second.projects.discard();
  }
});
