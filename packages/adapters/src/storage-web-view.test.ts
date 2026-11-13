import 'fake-indexeddb/auto';
import { createStore, get, set } from 'idb-keyval';
import { newBoardDoc } from '@pcbk/domain';
import type { ViewState } from '@pcbk/contracts';
import { expect, test } from 'vitest';
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

test('view writes capture caller data and preserve document revision, metadata and journal', async () => {
  const store = createStore(`web-view-test-${++sequence}`, 'projects');
  const repo = createWebRepository({ store, recentStorage });
  const opened = await repo.create({
    projectId: 'project_a',
    name: 'Board',
    doc: newBoardDoc('Board'),
  });
  const before = await get(`project:${opened.path}`, store);
  const view = {
    navigatorWidth: 355,
    navigatorTab: 'components',
    contextWidth: 460,
    contextOpen: false,
    boardView: { zoom: 1.5, pan: { x: -20, y: 34 } },
  };
  const saving = repo.saveView(opened.session, view);
  view.navigatorWidth = 999;
  view.contextWidth = 999;
  view.contextOpen = true;
  view.boardView.pan.x = 700;
  await saving;
  expect(await get(`project:${opened.path}`, store)).toEqual({
    ...before,
    view: {
      navigatorWidth: 355,
      navigatorTab: 'components',
      contextWidth: 460,
      contextOpen: false,
      boardView: { zoom: 1.5, pan: { x: -20, y: 34 } },
      modules: {},
    },
  });
});

test('web view writes normalize legacy fields and exclude theme without changing document data', async () => {
  const store = createStore(`web-view-test-${++sequence}`, 'projects');
  const repo = createWebRepository({ store, recentStorage });
  const opened = await repo.create({
    projectId: 'project_a',
    name: 'Board',
    doc: newBoardDoc('Board'),
  });
  const key = `project:${opened.path}`;
  const before = await get<Record<string, unknown>>(key, store);
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
  expect(await get(key, store)).toEqual(expected);
  await expect(
    repo.saveView(opened.session, { navigatorWidth: 0 } as ViewState),
  ).rejects.toMatchObject({
    reason: 'unknown',
  });
  expect(await get(key, store)).toEqual(expected);
});

test.each([
  { raw: undefined, expected: null },
  { raw: null, expected: null },
  { raw: 'broken', expected: null },
  { raw: [], expected: null },
  { raw: { navigatorWidth: -1 }, expected: null },
  { raw: { contextOpen: 'false' }, expected: null },
  {
    raw: { navigatorWidth: 410, navigatorTab: 'log' },
    expected: { navigatorWidth: 410, navigatorTab: 'log', contextWidth: 340, contextOpen: true },
  },
  {
    raw: { contextOpen: false, theme: 'dark' },
    expected: {
      navigatorWidth: 300,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: false,
    },
  },
])(
  'opening tolerates optional view %j while preserving the stored document',
  async ({ raw, expected }) => {
    const store = createStore(`web-view-test-${++sequence}`, 'projects');
    const repo = createWebRepository({ store, recentStorage });
    const opened = await repo.create({
      projectId: 'project_a',
      name: 'Board',
      doc: newBoardDoc('Board'),
    });
    const key = `project:${opened.path}`;
    const value = await get<Record<string, unknown>>(key, store);
    const stored = { ...value, view: raw };
    await set(key, stored, store);
    expect((await repo.open(opened.path)).view).toEqual(
      expected && { ...expected, boardView: { zoom: 1, pan: { x: 0, y: 0 } }, modules: {} },
    );
    expect((await repo.listProjects()).map((item) => item.path)).toEqual([opened.path]);
    expect(await get(key, store)).toEqual(stored);
  },
);
