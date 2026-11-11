import 'fake-indexeddb/auto';
import { createStore, get, set } from 'idb-keyval';
import { newBoardDoc } from '@pcbk/domain';
import { afterEach, expect, test, vi } from 'vitest';
import { createWebRepository } from './storage-web';

let sequence = 0;
const recentStorage: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};
const setup = () => {
  const store = createStore(`web-file-id-${++sequence}`, 'projects');
  return { store, repo: createWebRepository({ store, recentStorage }) };
};
const key = 'project:web://project_a';
const legacy = () => ({
  meta: { format_version: 1, project_id: 'project_a', created_at: 'before', app_version: '0.0.0' },
  doc: newBoardDoc('Board'),
  rev: 0,
  view: null,
  journal: [],
});
afterEach(() => vi.restoreAllMocks());

test('web create persists file identity independently of project identity and saves preserve it', async () => {
  const { store, repo } = setup();
  const doc = newBoardDoc('Board');
  const opened = await repo.create({ projectId: 'project_a', name: doc.name, doc });
  expect(opened.fileId).toEqual(expect.any(String));
  expect(opened.fileId).not.toBe('project_a');
  await repo.save({
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...doc, rev: 1 },
    journal: [],
  });
  expect(await get(key, store)).toMatchObject({ meta: { file_id: opened.fileId } });
  expect((await createWebRepository({ store, recentStorage }).open(opened.path)).fileId).toBe(
    opened.fileId,
  );
});

test('concurrent legacy opens atomically persist one file identity without changing stored state', async () => {
  const { store, repo } = setup();
  const before = legacy();
  await set(key, before, store);
  expect(await repo.listProjects()).toHaveLength(1);
  expect(await get(key, store)).toEqual(before);
  const [first, second] = await Promise.all([
    repo.open('web://project_a'),
    createWebRepository({ store, recentStorage }).open('web://project_a'),
  ]);
  expect(first.fileId).toEqual(expect.any(String));
  expect(second.fileId).toBe(first.fileId);
  expect(await get(key, store)).toEqual({
    ...before,
    meta: { ...before.meta, file_id: first.fileId },
  });
});

test('a failed legacy identity write does not open a session or mutate the old record', async () => {
  const { store, repo } = setup();
  const before = legacy();
  await set(key, before, store);
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
    throw new DOMException('blocked', 'ReadOnlyError');
  });
  await expect(repo.open('web://project_a')).rejects.toMatchObject({ reason: 'read_only' });
  expect(await get(key, store)).toEqual(before);
  expect((await repo.open('web://project_a')).fileId).toEqual(expect.any(String));
});
