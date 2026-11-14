import { newBoardDoc } from '@pcbk/domain';
import { StorageError } from './ports';
import { expect, test, vi } from 'vitest';
import { projectSetup, seed } from './__tests__/project-helpers';

function board() {
  const doc = newBoardDoc('Fotodega');
  doc.photos.push({
    id: 'pho_kept',
    side: 'top',
    name: 'Plaat',
    widthPx: 2,
    heightPx: 3,
    transform: 'none',
  });
  return doc;
}

test('project_open_prunes_unreferenced_photos_when_writable', async () => {
  const prune = vi.fn().mockResolvedValue(undefined);
  let storageSession = '';
  const { projects, store, path, host } = await projectSetup({
    create: false,
    photos: { prune },
    wrap: (repo) => ({
      ...repo,
      async open(path) {
        const opened = await repo.open(path);
        storageSession = opened.session;
        return opened;
      },
    }),
  });
  seed(store, path, board());
  prune.mockImplementation(async () => {
    expect(host.current()).toBeNull();
  });
  const opened = await projects.open({ path });
  expect(opened.ok).toBe(true);
  expect(prune).toHaveBeenCalledExactlyOnceWith(storageSession, ['pho_kept']);
  expect(host.current()!.sessionId).not.toBe(storageSession);
  await projects.close();
});

test('read_only_open_does_not_prune', async () => {
  const prune = vi.fn().mockResolvedValue(undefined);
  const { projects, store, path } = await projectSetup({ create: false, photos: { prune } });
  seed(store, path, board(), 1, true);
  expect(await projects.open({ path })).toMatchObject({ ok: true, value: { readOnly: true } });
  expect(prune).not.toHaveBeenCalled();
  await projects.close();
});

test('failed photo prune preserves the previous project and releases the new handle', async () => {
  const prune = vi.fn().mockResolvedValue(undefined);
  const { projects, store, host } = await projectSetup({ photos: { prune } });
  const session = host.current()!.sessionId;
  seed(store, 'other.pcbk', board());
  prune.mockRejectedValueOnce(new StorageError('disk_full'));
  expect(await projects.open({ path: 'other.pcbk' })).toEqual({
    ok: false,
    error: { code: 'storage', reason: 'disk_full' },
  });
  expect(host.current()!.sessionId).toBe(session);
  expect(store.locks.has('other.pcbk')).toBe(false);
  await projects.close();
});
