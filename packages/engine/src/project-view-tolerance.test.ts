import { newBoardDoc } from '@pcbk/domain';
import type { ViewState } from '@pcbk/contracts';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { projectSetup, seed } from './__tests__/project-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test.each([
  {
    name: 'legacy two-field view',
    raw: { navigatorWidth: 420, navigatorTab: 'log' },
    expected: { navigatorWidth: 420, navigatorTab: 'log', contextWidth: 340, contextOpen: true },
  },
  {
    name: 'empty saved object',
    raw: {},
    expected: {
      navigatorWidth: 300,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: true,
    },
  },
  {
    name: 'partially saved context',
    raw: { contextWidth: 450, contextOpen: false },
    expected: {
      navigatorWidth: 300,
      navigatorTab: 'components',
      contextWidth: 450,
      contextOpen: false,
    },
  },
  {
    name: 'unknown fields and global theme',
    raw: {
      navigatorWidth: 1,
      navigatorTab: 'future-tab',
      contextWidth: 9000,
      contextOpen: false,
      theme: 'dark',
      future: 7,
    },
    expected: {
      navigatorWidth: 1,
      navigatorTab: 'future-tab',
      contextWidth: 9000,
      contextOpen: false,
    },
  },
])('open normalizes a $name without rewriting the project', async ({ raw, expected }) => {
  const { engine, projects, store, path, memory } = await projectSetup({ create: false });
  seed(store, path, newBoardDoc('Saved board'));
  (store.files.get(path)! as { view: unknown }).view = raw;
  expect(await projects.open({ path })).toMatchObject({ ok: true, value: { view: expected } });
  const opened = await projects.open({ path });
  if (!opened.ok) throw new Error('Expected an opened project');
  expect(opened.value.view).toEqual({
    ...expected,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
  expect(engine.snapshot().doc.name).toBe('Saved board');
  expect(store.files.get(path)!.view).toEqual(raw);
  expect(memory.documentWrites).toBe(0);
  expect(memory.viewWrites).toBe(0);
});

test.each(
  [
    undefined,
    null,
    'broken',
    7,
    [],
    { navigatorWidth: 0 },
    { navigatorWidth: -1 },
    { navigatorWidth: NaN },
    { navigatorWidth: Infinity },
    { navigatorWidth: '300' },
    { navigatorTab: '' },
    { navigatorTab: 4 },
    { contextWidth: 0 },
    { contextWidth: -1 },
    { contextWidth: Infinity },
    { contextWidth: NaN },
    { contextWidth: '340' },
    { contextOpen: 'true' },
    { contextOpen: null },
  ].map((raw) => ({ raw })),
)('unusable view %j never prevents opening a valid document', async ({ raw }) => {
  const { engine, projects, store, path } = await projectSetup({ create: false });
  seed(store, path, newBoardDoc('Saved board'));
  (store.files.get(path)! as { view: unknown }).view = raw;
  expect(await projects.open({ path })).toMatchObject({ ok: true, value: { view: null } });
  expect(engine.snapshot().doc.name).toBe('Saved board');
});

test('saveView normalizes legacy fields and discards theme and unknown properties', async () => {
  const { engine, projects, store, path, memory } = await projectSetup();
  projects.saveView({
    navigatorWidth: 410,
    navigatorTab: 'log',
    theme: 'dark',
  } as unknown as ViewState);
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get(path)!.view).toEqual({
    navigatorWidth: 410,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
  projects.saveView({ navigatorWidth: 0 } as ViewState);
  expect((await projects.flush()).ok).toBe(true);
  expect(memory.viewWrites).toBe(1);
  expect(memory.documentWrites).toBe(0);
  expect(engine.snapshot().rev).toBe(0);
  expect(store.files.get(path)!.journal).toEqual([]);
});
