import 'fake-indexeddb/auto';
import { createStore, get, set } from 'idb-keyval';
import { newBoardDoc } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { createWebRepository } from './storage-web';

let sequence = 0;
const createdAt = '2026-11-08T12:00:00.000Z';
function setup() {
  const store = createStore(`web-list-test-${++sequence}`, 'projects');
  const values = new Map<string, string>();
  const recentStorage: Storage = {
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
  let now = createdAt;
  const repo = createWebRepository({ store, recentStorage, now: () => now });
  const create = (projectId: string) =>
    repo.create({
      projectId,
      name: `Board ${projectId}`,
      doc: { ...newBoardDoc(`Board ${projectId}`), device: 'Radio' },
    });
  return {
    store,
    recentStorage,
    repo,
    create,
    setNow: (value: string) => {
      now = value;
    },
  };
}

test('all projects remain available after the recent list reaches its twenty-card limit', async () => {
  const { repo, create } = setup();
  for (let index = 0; index < 21; index++) await create(`project_${index}`);
  expect(repo.recents()).toHaveLength(20);
  expect(repo.recents().some((item) => item.projectId === 'project_0')).toBe(false);
  const all = await repo.listProjects();
  expect(all).toHaveLength(21);
  expect(all).toContainEqual({
    path: 'web://project_0',
    projectId: 'project_0',
    name: 'Board project_0',
    device: 'Radio',
    updatedAt: createdAt,
  });
});

test('listing uses current document names and modification times without writing project data', async () => {
  const { repo, store, create, setNow } = setup();
  const opened = await create('project_a');
  setNow('2026-11-08T14:00:00.000Z');
  await repo.save({
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Renamed'), rev: 1 },
    journal: [],
  });
  await repo.saveView(opened.session, {
    navigatorWidth: 350,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
  });
  const before = await get(`project:${opened.path}`, store);
  const recentsBefore = repo.recents();
  const listed = await repo.listProjects();
  expect(listed).toEqual([
    {
      path: opened.path,
      projectId: 'project_a',
      name: 'Renamed',
      updatedAt: '2026-11-08T14:00:00.000Z',
    },
  ]);
  listed[0]!.name = 'Caller mutation';
  expect((await repo.listProjects())[0]!.name).toBe('Renamed');
  expect(await get(`project:${opened.path}`, store)).toEqual(before);
  expect(repo.recents()).toEqual(recentsBefore);
  repo.removeRecent(opened.path);
  expect((await repo.listProjects())[0]!.updatedAt).toBe('2026-11-08T14:00:00.000Z');
});

test('modification time survives a removed recent card and a fresh repository', async () => {
  const { repo, store, recentStorage, create, setNow } = setup();
  const opened = await create('project_a');
  setNow('2026-11-08T14:00:00.000Z');
  await repo.save({
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Renamed'), rev: 1 },
    journal: [],
  });
  setNow('2026-11-08T16:00:00.000Z');
  expect((await repo.open(opened.path)).savedAt).toBe('2026-11-08T14:00:00.000Z');
  await repo.saveView(opened.session, {
    navigatorWidth: 360,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
  });
  expect(repo.recents()[0]!.updatedAt).toBe('2026-11-08T14:00:00.000Z');
  repo.removeRecent(opened.path);
  const fresh = createWebRepository({ store, recentStorage });
  expect((await fresh.listProjects())[0]!.updatedAt).toBe('2026-11-08T14:00:00.000Z');
  expect(await get(`project:${opened.path}`, store)).toMatchObject({
    meta: { created_at: createdAt, updated_at: '2026-11-08T14:00:00.000Z' },
  });
});

test('older project records fall back to creation time regardless of later opening time', async () => {
  const { repo, store, create, setNow } = setup();
  const opened = await create('project_a');
  const old = await get<{ meta: { updated_at?: string } }>(`project:${opened.path}`, store);
  delete old!.meta.updated_at;
  await set(`project:${opened.path}`, old, store);
  setNow('2026-11-08T16:00:00.000Z');
  expect((await repo.open(opened.path)).savedAt).toBe(createdAt);
  expect((await repo.listProjects())[0]!.updatedAt).toBe(createdAt);
  expect(await get(`project:${opened.path}`, store)).toEqual(old);
});

test('a corrupt record and unrelated keys do not hide valid projects or get removed', async () => {
  const { repo, store, create } = setup();
  await create('project_valid');
  await set('project:web://broken', { broken: true }, store);
  await set('unrelated', { ignored: true }, store);
  await set(42, { ignored: true }, store);
  expect(await repo.listProjects()).toMatchObject([{ projectId: 'project_valid' }]);
  await expect(repo.open('web://broken')).rejects.toMatchObject({ reason: 'not_project' });
  expect(await get('project:web://broken', store)).toEqual({ broken: true });
  expect(await get('unrelated', store)).toEqual({ ignored: true });
});
