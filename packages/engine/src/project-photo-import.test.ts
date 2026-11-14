import { describe, expect, it, vi } from 'vitest';
import type { PhotoRef } from '@pcbk/domain';
import type { StorageReason } from '@pcbk/contracts';
import { createMemoryRepository, createMemoryStore } from '../../adapters/src/storage-memory';
import { createEngine, createProjectService, StorageError } from './index';
import type { PhotoStore, ProjectRepository } from './ports';
import { clock, demo, withTestOwners } from './__tests__/helpers';
import { deferred } from './__tests__/project-helpers';

const file = { bytes: new Uint8Array([137, 80, 78, 71]).buffer, name: 'Plaat õ.png' };
const photo: PhotoRef = {
  id: 'pho_3',
  side: 'top',
  name: file.name,
  widthPx: 120,
  heightPx: 80,
  transform: 'none',
};

function setup(wrap?: (repo: ProjectRepository) => ProjectRepository) {
  const store = createMemoryStore();
  const memory = createMemoryRepository(store);
  const repo = wrap ? wrap(memory) : memory;
  const { engine, host } = createEngine({ modules: withTestOwners([demo]), clock });
  const importBytes = vi.fn<PhotoStore['importBytes']>().mockResolvedValue(photo);
  let sequence = 0;
  const newId = vi.fn((prefix: string) => `${prefix}_${++sequence}`);
  const projects = createProjectService({
    engine,
    host,
    repo,
    photos: { prune: async () => undefined, url: () => '', importBytes },
    clock,
    ids: { newId },
  });
  return { projects, engine, store, memory, importBytes, newId };
}

describe('project photo import', () => {
  it('import_photo_uses_active_session_and_pho_id', async () => {
    const { projects, engine, store, memory, importBytes, newId } = setup();
    const created = await projects.create({ name: 'Board', path: 'board.pcbk' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const nativeSession = store.locks.get('board.pcbk');
    expect(nativeSession).not.toBe(created.value.sessionId);
    const before = engine.snapshot();

    expect(await projects.importPhoto(file)).toEqual({ ok: true, value: photo });

    expect(newId).toHaveBeenLastCalledWith('pho');
    expect(importBytes).toHaveBeenCalledExactlyOnceWith(
      nativeSession,
      file.bytes,
      'pho_3',
      file.name,
    );
    expect(importBytes.mock.calls[0]![1]).toBe(file.bytes);
    expect(engine.snapshot()).toBe(before);
    expect(await projects.flush()).toEqual({ ok: true, value: undefined });
    expect(memory.documentWrites).toBe(0);
    expect(await projects.close()).toEqual({ ok: true, value: undefined });
  });

  it('import_photo_without_project_fails', async () => {
    const { projects, importBytes, newId } = setup();
    expect(await projects.importPhoto(file)).toEqual({
      ok: false,
      error: { code: 'stale_session' },
    });
    expect(newId).not.toHaveBeenCalled();
    expect(importBytes).not.toHaveBeenCalled();
  });

  it.each<StorageReason>(['unsupported_image', 'image_too_large', 'corrupt_image', 'read_only'])(
    'retains photo port storage reason %s and permits the next operation',
    async (reason) => {
      const { projects, importBytes } = setup();
      expect((await projects.create({ name: 'Board' })).ok).toBe(true);
      importBytes.mockRejectedValueOnce(new StorageError(reason));
      expect(await projects.importPhoto(file)).toEqual({
        ok: false,
        error: { code: 'storage', reason },
      });
      expect(await projects.importPhoto(file)).toEqual({ ok: true, value: photo });
      expect((await projects.close()).ok).toBe(true);
    },
  );

  it('waits for project acquisition before selecting the active storage session', async () => {
    const started = deferred();
    const release = deferred();
    const { projects, store, importBytes } = setup((repo) => ({
      ...repo,
      async create(req) {
        started.resolve();
        await release.promise;
        return repo.create(req);
      },
    }));
    const creating = projects.create({ name: 'Board', path: 'board.pcbk' });
    await started.promise;
    const importing = projects.importPhoto(file);
    expect(importBytes).not.toHaveBeenCalled();
    release.resolve();
    expect((await creating).ok).toBe(true);
    expect((await importing).ok).toBe(true);
    expect(importBytes.mock.calls[0]![0]).toBe(store.locks.get('board.pcbk'));
    expect((await projects.close()).ok).toBe(true);
  });

  it('keeps the storage handle open until import finishes and rejects imports after close', async () => {
    const started = deferred();
    const release = deferred();
    const { projects, engine, store, importBytes } = setup();
    expect((await projects.create({ name: 'Board', path: 'board.pcbk' })).ok).toBe(true);
    importBytes.mockImplementationOnce(async () => {
      started.resolve();
      await release.promise;
      return photo;
    });
    const importing = projects.importPhoto(file);
    await started.promise;
    const closing = projects.close();
    const afterClose = projects.importPhoto(file);
    expect(store.locks.has('board.pcbk')).toBe(true);
    expect(engine.snapshot()).not.toBeNull();
    release.resolve();
    expect((await importing).ok).toBe(true);
    expect((await closing).ok).toBe(true);
    expect(store.locks.size).toBe(0);
    expect(await afterClose).toEqual({ ok: false, error: { code: 'stale_session' } });
    expect(importBytes).toHaveBeenCalledTimes(1);
  });

  it('uses the copied storage handle while the logical engine session stays the same', async () => {
    const { projects, store, importBytes } = setup();
    const created = await projects.create({ name: 'Board', path: 'board.pcbk' });
    const originalSession = store.locks.get('board.pcbk');
    const copied = await projects.copy({ dest: 'copy.pcbk', identity: 'same' });
    expect(created.ok && copied.ok).toBe(true);
    if (!created.ok || !copied.ok) return;
    expect(copied.value.sessionId).toBe(created.value.sessionId);
    expect((await projects.importPhoto(file)).ok).toBe(true);
    expect(importBytes.mock.calls[0]![0]).toBe(store.locks.get('copy.pcbk'));
    expect(importBytes.mock.calls[0]![0]).not.toBe(originalSession);
    expect((await projects.close()).ok).toBe(true);
  });
});
