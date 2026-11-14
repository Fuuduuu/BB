import 'fake-indexeddb/auto';
import { createStore, del, get, set } from 'idb-keyval';
import { newBoardDoc } from '@pcbk/domain';
import type { JournalEntry } from '@pcbk/engine';
import { afterEach, expect, test, vi } from 'vitest';
import { createWebRepository } from './storage-web';
let sequence = 0;
const at = '2026-11-08T12:00:00.000Z';
const entry: JournalEntry = {
  at,
  kind: 'command',
  commandId: 'project.rename',
  source: 'user',
  summary: 'Rename board',
};
function localStore(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
function setup(recentStorage = localStore()) {
  const store = createStore(`web-test-${++sequence}`, 'projects');
  const options = { store, recentStorage, now: () => at };
  return { store, options, repo: createWebRepository(options), recentStorage };
}
const request = (id = 'project_a') => ({
  projectId: id,
  name: 'Board',
  doc: newBoardDoc('Board'),
});
afterEach(() => vi.restoreAllMocks());

test('create and open persist a detached document, revision, journal, metadata and view', async () => {
  const { repo, store, options } = setup();
  const req = request();
  req.doc.device = 'Radio';
  const creating = repo.create(req);
  req.doc.name = 'Caller mutation';
  const opened = await creating;
  expect(opened).toMatchObject({
    path: 'web://project_a',
    projectId: 'project_a',
    readOnly: false,
  });
  expect(opened.doc).toMatchObject({ name: 'Board', device: 'Radio', rev: 0 });
  await repo.save({
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Renamed'), rev: 1 },
    journal: [entry],
  });
  await repo.saveView(opened.session, {
    navigatorWidth: 320,
    navigatorOpen: true,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
  });
  await repo.close(opened.session);
  const again = await createWebRepository(options).open(opened.path);
  expect(again.doc).toMatchObject({ name: 'Renamed', rev: 1 });
  expect(again.view).toEqual({
    navigatorWidth: 320,
    navigatorOpen: true,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
    modules: {},
  });
  expect(await get(`project:${opened.path}`, store)).toMatchObject({
    meta: { format_version: 1, project_id: 'project_a', created_at: at, app_version: '0.0.0' },
    rev: 1,
    journal: [entry],
  });
  (again.doc as { name: string }).name = 'Returned mutation';
  expect((await repo.open(opened.path)).doc).toMatchObject({ name: 'Renamed' });
});

test('duplicate create refuses to replace the existing project', async () => {
  const { repo } = setup();
  const opened = await repo.create(request());
  await expect(
    repo.create({ ...request(), doc: newBoardDoc('Replacement') }),
  ).rejects.toMatchObject({ reason: 'unknown' });
  expect((await repo.open(opened.path)).doc).toMatchObject({ name: 'Board' });
});

test('concurrent saves from the same base revision have one winner and one intact journal', async () => {
  const { repo, store, options } = setup();
  const first = await repo.create(request());
  const other = createWebRepository(options);
  const second = await other.open(first.path);
  const results = await Promise.allSettled([
    repo.save({
      session: first.session,
      baseRev: 0,
      rev: 1,
      doc: { ...newBoardDoc('Winner A'), rev: 1 },
      journal: [{ ...entry, summary: 'A' }],
    }),
    other.save({
      session: second.session,
      baseRev: 0,
      rev: 1,
      doc: { ...newBoardDoc('Winner B'), rev: 1 },
      journal: [{ ...entry, summary: 'B' }],
    }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const failed = results.find((result) => result.status === 'rejected');
  expect(failed).toMatchObject({ reason: { reason: 'unknown', actualRev: 1 } });
  const stored = await get<{ doc: { name: string }; journal: JournalEntry[] }>(
    `project:${first.path}`,
    store,
  );
  expect(stored!.journal).toHaveLength(1);
  expect(stored!.doc.name).toBe(`Winner ${stored!.journal[0]!.summary}`);
});

test('save captures caller data before waiting and appends the journal atomically', async () => {
  const { repo, store } = setup();
  const opened = await repo.create(request());
  const req = {
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Saved'), rev: 1 },
    journal: [{ ...entry }],
  };
  const saving = repo.save(req);
  req.doc.name = 'Mutation';
  req.rev = 7;
  req.journal[0]!.summary = 'Mutation';
  await saving;
  await repo.save({
    session: opened.session,
    baseRev: 1,
    rev: 2,
    doc: { ...newBoardDoc('Next'), rev: 2 },
    journal: [{ ...entry, kind: 'undo' }],
  });
  expect(await get(`project:${opened.path}`, store)).toMatchObject({
    rev: 2,
    doc: { name: 'Next' },
    journal: [entry, { ...entry, kind: 'undo' }],
  });
});

test('quota failure leaves the document and journal unchanged and can be retried', async () => {
  const { repo, store } = setup();
  const opened = await repo.create(request());
  const req = {
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Saved'), rev: 1 },
    journal: [entry],
  };
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });
  await expect(repo.save(req)).rejects.toMatchObject({ reason: 'disk_full' });
  expect(await get(`project:${opened.path}`, store)).toMatchObject({
    rev: 0,
    doc: { name: 'Board' },
    journal: [],
  });
  await repo.save(req);
  expect((await repo.open(opened.path)).doc).toMatchObject({ name: 'Saved', rev: 1 });
});

test('closed sessions and missing projects cannot write or recreate records', async () => {
  const { repo, store } = setup();
  const opened = await repo.create(request());
  await repo.close(opened.session);
  const save = {
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Saved'), rev: 1 },
    journal: [],
  };
  await expect(repo.save(save)).rejects.toMatchObject({ reason: 'missing' });
  await expect(
    repo.saveView(opened.session, {
      navigatorWidth: 320,
      navigatorOpen: true,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: true,
    }),
  ).rejects.toMatchObject({ reason: 'missing' });
  const again = await repo.open(opened.path);
  await del(`project:${opened.path}`, store);
  await expect(repo.save({ ...save, session: again.session })).rejects.toMatchObject({
    reason: 'missing',
  });
  await expect(repo.open(opened.path)).rejects.toMatchObject({ reason: 'missing' });
  expect(await get(`project:${opened.path}`, store)).toBeUndefined();
});

test('save rejects an inconsistent revision without changing the stored project', async () => {
  const { repo, store } = setup();
  const opened = await repo.create(request());
  const before = await get(`project:${opened.path}`, store);
  await expect(
    repo.save({
      session: opened.session,
      baseRev: 0,
      rev: 1,
      doc: newBoardDoc('Mismatch'),
      journal: [entry],
    }),
  ).rejects.toMatchObject({ reason: 'unknown' });
  expect(await get(`project:${opened.path}`, store)).toEqual(before);
});

test('save updates format metadata in the same commit as the document', async () => {
  const { repo, store } = setup();
  const opened = await repo.create(request());
  const old = await get<{ meta: { format_version: number }; doc: { format_version: number } }>(
    `project:${opened.path}`,
    store,
  );
  old!.meta.format_version = 0;
  old!.doc.format_version = 0;
  await set(`project:${opened.path}`, old, store);
  await repo.save({
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Migrated'), rev: 1 },
    journal: [entry],
  });
  expect(await get(`project:${opened.path}`, store)).toMatchObject({
    meta: { format_version: 1, created_at: at },
    doc: { format_version: 1, rev: 1 },
    journal: [entry],
  });
});

test('close invalidates a queued write before its transaction runs', async () => {
  const { repo } = setup();
  const opened = await repo.create(request());
  const saving = repo.save({
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Too late'), rev: 1 },
    journal: [entry],
  });
  await repo.close(opened.session);
  await expect(saving).rejects.toMatchObject({ reason: 'missing' });
  expect((await repo.open(opened.path)).doc).toMatchObject({ name: 'Board', rev: 0 });
});
