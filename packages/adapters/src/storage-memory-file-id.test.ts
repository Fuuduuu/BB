import { newBoardDoc } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { createMemoryRepository, createMemoryStore } from './storage-memory';

test('memory open preserves file identity and copy and restore create independent file identities', async () => {
  const repo = createMemoryRepository();
  const doc = newBoardDoc('Board');
  const first = await repo.create({ projectId: 'project_a', name: doc.name, doc });
  expect(first.fileId).toEqual(expect.any(String));
  await repo.close(first.session);
  const reopened = await repo.open(first.path);
  expect(reopened.fileId).toBe(first.fileId);
  await repo.backupFull(reopened.session, 'migration');
  const [backup] = await repo.backups(first.projectId);
  expect(backup!.fileId).toBe(first.fileId);
  const restored = await repo.restore({ backup: backup!.file, dest: 'restored.pcbk' });
  expect(restored.fileId).not.toBe(first.fileId);
  for (const identity of ['same', 'new'] as const) {
    const copy = await repo.copy({
      session: reopened.session,
      projectId: identity === 'same' ? first.projectId : 'project_b',
      identity,
      dest: `${identity}.pcbk`,
      doc,
      rev: 0,
      view: null,
      journal: [],
    });
    expect(copy.fileId).not.toBe(first.fileId);
    expect(copy.fileId).not.toBe(restored.fileId);
    expect(copy.fromMemory).toBe(false);
  }
});

test('memory rescue copy reports memory fallback when the original file disappears', async () => {
  const store = createMemoryStore();
  const repo = createMemoryRepository(store);
  const doc = newBoardDoc('Board');
  const first = await repo.create({ projectId: 'project_a', name: doc.name, doc });
  store.files.delete(first.path);
  const copy = await repo.copy({
    session: first.session,
    projectId: first.projectId,
    identity: 'same',
    dest: 'rescue.pcbk',
    doc,
    rev: 0,
    view: null,
    journal: [],
  });
  expect(copy).toMatchObject({ fromMemory: true, doc });
  expect(copy.fileId).toEqual(expect.any(String));
  expect(copy.fileId).not.toBe(first.fileId);
});
