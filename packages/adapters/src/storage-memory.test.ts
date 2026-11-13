import { newBoardDoc } from '@pcbk/domain';
import type { ViewState } from '@pcbk/contracts';
import * as api from '@pcbk/engine';
import { expect, test } from 'vitest';
import * as storage from './storage-memory';

function setup() {
  expect(storage.createMemoryStore).toBeTypeOf('function');
  const store = storage.createMemoryStore();
  return { store, repo: storage.createMemoryRepository(store) };
}

test('memory view writes normalize legacy fields and exclude theme without changing document data', async () => {
  const { store, repo } = setup();
  const opened = await repo.create({
    projectId: 'project_a',
    name: 'Board',
    doc: newBoardDoc('Board'),
  });
  const before = structuredClone(store.files.get(opened.path)!);
  await repo.saveView(opened.session, {
    navigatorWidth: 420,
    navigatorTab: 'log',
    theme: 'dark',
    future: 7,
  } as unknown as ViewState);
  const expected = {
    ...before,
    view: {
      navigatorWidth: 420,
      navigatorTab: 'log',
      contextWidth: 340,
      contextOpen: true,
      boardView: { zoom: 1, pan: { x: 0, y: 0 } },
      modules: {},
    },
  };
  expect(store.files.get(opened.path)).toEqual(expected);
  await expect(
    repo.saveView(opened.session, { navigatorWidth: 0 } as ViewState),
  ).rejects.toMatchObject({
    reason: 'unknown',
  });
  expect(store.files.get(opened.path)).toEqual(expected);
  expect(repo.documentWrites).toBe(0);
  expect(repo.viewWrites).toBe(1);
});
test('memory repository shares data and exclusive locks between instances', async () => {
  const { store, repo } = setup();
  const doc = newBoardDoc('Board');
  const opened = await repo.create({
    projectId: 'project_a',
    name: doc.name,
    path: 'Board.pcbk',
    doc,
  });
  const other = storage.createMemoryRepository(store);
  await expect(other.open(opened.path)).rejects.toMatchObject({ reason: 'locked' });
  doc.name = 'Caller mutation';
  expect(store.files.get(opened.path)!.doc).toMatchObject({ name: 'Board' });
  await repo.close(opened.session);
  expect((await other.open(opened.path)).doc).toMatchObject({ name: 'Board' });
});
test('memory repository compares base revision atomically before writing document or journal', async () => {
  const { store, repo } = setup();
  const doc = newBoardDoc('Board');
  const opened = await repo.create({
    projectId: 'project_a',
    name: doc.name,
    path: 'Board.pcbk',
    doc,
  });
  await expect(
    repo.save({
      session: opened.session,
      baseRev: 5,
      rev: 1,
      doc: { ...doc, rev: 1 },
      journal: [],
    }),
  ).rejects.toMatchObject({ actualRev: 0 });
  expect(store.files.get(opened.path)!.rev).toBe(0);
  expect(repo.documentWrites).toBe(0);
  await repo.save({
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...doc, rev: 1 },
    journal: [],
  });
  expect(store.files.get(opened.path)!.rev).toBe(1);
});
test('failed and read-only writes do not mutate the file or increment successful writes', async () => {
  const { store, repo } = setup();
  const doc = newBoardDoc('Board');
  const opened = await repo.create({
    projectId: 'project_a',
    name: doc.name,
    path: 'Board.pcbk',
    doc,
  });
  const request = {
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...doc, rev: 1 },
    journal: [],
  };
  repo.failNext('disk_full');
  await expect(repo.save(request)).rejects.toBeInstanceOf(api.StorageError);
  repo.setReadOnly(opened.path, true);
  await expect(repo.save(request)).rejects.toMatchObject({ reason: 'read_only' });
  expect(store.files.get(opened.path)!.rev).toBe(0);
  expect(repo.documentWrites).toBe(0);
});
test('backup and restore preserve original data and refuse to overwrite a destination', async () => {
  const { store, repo } = setup();
  const doc = newBoardDoc('Board');
  const opened = await repo.create({
    projectId: 'project_a',
    name: doc.name,
    path: 'Board.pcbk',
    doc,
  });
  await repo.backupFull(opened.session, 'migration');
  const [backup] = await repo.backups('project_a');
  const restored = await repo.restore({ backup: backup!.file, dest: 'Restored.pcbk' });
  expect(restored.projectId).toBe('project_a');
  expect(restored.doc).toEqual(doc);
  await expect(
    repo.restore({ backup: backup!.file, dest: 'Restored.pcbk' }),
  ).rejects.toBeInstanceOf(api.StorageError);
  expect(store.files.size).toBe(2);
});
