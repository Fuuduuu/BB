import 'fake-indexeddb/auto';
import { createStore, get, set } from 'idb-keyval';
import type { UseStore } from 'idb-keyval';
import { newBoardDoc } from '@pcbk/domain';
import { StorageError } from '@pcbk/engine';
import type { JournalEntry } from '@pcbk/engine';
import { afterEach, expect, test, vi } from 'vitest';
import { createWebRepository } from './storage-web';
let sequence = 0;
const at = '2026-11-08T12:00:00.000Z';
const recentKey = 'bb:recent-projects';
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

test('unsupported copy, backup, restore and backup listing reject explicitly', async () => {
  const { repo } = setup();
  const opened = await repo.create(request());
  for (const result of [
    repo.copy({
      session: opened.session,
      projectId: 'project_b',
      dest: 'web://project_b',
      identity: 'new',
      doc: newBoardDoc('Copy'),
      rev: 0,
      view: null,
      journal: [],
    }),
    repo.backupFull(opened.session, 'migration'),
    repo.backups('project_a'),
    repo.restore({ backup: 'backup', dest: 'web://restored' }),
  ])
    await expect(result).rejects.toMatchObject({ reason: 'unknown' });
});

test('recents update names on save, de-duplicate paths and remove only the chosen card', async () => {
  const { repo, recentStorage, options } = setup();
  const a = await repo.create({ ...request(), doc: { ...newBoardDoc('Board'), device: 'Radio' } });
  await repo.create(request('project_b'));
  await repo.save({
    session: a.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Renamed'), device: 'Radio', rev: 1 },
    journal: [],
  });
  expect(repo.recents()).toEqual([
    { path: a.path, projectId: 'project_a', name: 'Renamed', device: 'Radio', updatedAt: at },
    { path: 'web://project_b', projectId: 'project_b', name: 'Board', updatedAt: at },
  ]);
  const cards = repo.recents();
  cards[0]!.name = 'Mutation';
  expect(createWebRepository(options).recents()[0]!.name).toBe('Renamed');
  repo.removeRecent(a.path);
  expect(JSON.parse(recentStorage.getItem(recentKey)!)).toHaveLength(1);
  expect((await repo.open(a.path)).doc).toMatchObject({ name: 'Renamed' });
  expect(repo.recents()[0]!.projectId).toBe('project_a');
});

test('recent parsing ignores malformed, invalid and duplicate entries and caps at twenty', async () => {
  const { repo, recentStorage } = setup();
  recentStorage.setItem(recentKey, '{broken');
  expect(repo.recents()).toEqual([]);
  recentStorage.setItem(
    recentKey,
    JSON.stringify([
      null,
      {},
      { path: 'web://x', projectId: 'x', name: 7, updatedAt: at },
      ...Array.from({ length: 25 }, (_, index) => ({
        path: `web://p${index}`,
        projectId: `p${index}`,
        name: `Board ${index}`,
        updatedAt: at,
      })),
      { path: 'web://p0', projectId: 'p0', name: 'Duplicate', updatedAt: at },
    ]),
  );
  expect(repo.recents()).toHaveLength(20);
  expect(repo.recents()[0]!.name).toBe('Board 0');
  await repo.create(request());
  expect(repo.recents()).toHaveLength(20);
  expect(repo.recents()[0]!.name).toBe('Board');
});

test('denied localStorage keeps successful document writes and session recents usable', async () => {
  const denied = localStore();
  denied.getItem = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  denied.setItem = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  const { repo } = setup(denied);
  const opened = await repo.create(request());
  await repo.save({
    session: opened.session,
    baseRev: 0,
    rev: 1,
    doc: { ...newBoardDoc('Saved'), rev: 1 },
    journal: [entry],
  });
  expect((await repo.open(opened.path)).doc).toMatchObject({ name: 'Saved', rev: 1 });
  expect(repo.recents()).toMatchObject([{ name: 'Saved', path: opened.path }]);
  repo.removeRecent(opened.path);
  expect(repo.recents()).toEqual([]);
});

test.each(['SecurityError', 'NotAllowedError'])(
  'maps %s from IndexedDB to read_only',
  async (name) => {
    const store: UseStore = async () => {
      throw new DOMException('denied', name);
    };
    const repo = createWebRepository({ store, recentStorage: localStore() });
    await expect(repo.open('web://project_a')).rejects.toBeInstanceOf(StorageError);
    await expect(repo.create(request())).rejects.toMatchObject({ reason: 'read_only' });
  },
);

test.each([
  null,
  {},
  { meta: {}, doc: {}, rev: 0, journal: [], view: null },
  {
    meta: { project_id: 'project_a', format_version: 1, created_at: at, app_version: '0.0.0' },
    doc: newBoardDoc('Wrong revision'),
    rev: 1,
    journal: [],
    view: null,
  },
  {
    meta: { project_id: 'project_a', format_version: 1, created_at: at, app_version: '0.0.0' },
    doc: newBoardDoc('Broken journal'),
    rev: 0,
    journal: [null],
    view: null,
  },
])('rejects corrupted project envelopes without modifying them', async (value) => {
  const { repo, store } = setup();
  await set('project:web://project_a', value, store);
  await expect(repo.open('web://project_a')).rejects.toMatchObject({ reason: 'not_project' });
  expect(await get('project:web://project_a', store)).toEqual(value);
});
