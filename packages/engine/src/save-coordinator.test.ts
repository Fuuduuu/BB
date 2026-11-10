import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { blockFirstSave, projectSetup } from './__tests__/project-helpers';
import * as api from './index';
import type { SaveReq } from './ports';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test('saves 1.5 s after the last command', async () => {
  const { engine, projects, memory, store, path } = await projectSetup();
  engine.execute('demo.rename', { name: 'First' });
  await vi.advanceTimersByTimeAsync(1000);
  engine.execute('demo.rename', { name: 'Last' });
  await vi.advanceTimersByTimeAsync(1499);
  expect(memory.documentWrites).toBe(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(memory.documentWrites).toBe(1);
  expect(store.files.get(path)!.doc).toEqual(engine.snapshot().doc);
  await projects.close();
});
test('continuous work attempts a save within 10 seconds', async () => {
  const starts: number[] = [];
  const { engine, projects } = await projectSetup({
    wrap: (repo) => ({
      ...repo,
      async save(req) {
        starts.push(Date.now());
        await repo.save(req);
      },
    }),
  });
  const began = Date.now();
  for (let i = 0; i < 12; i++) {
    engine.execute('demo.rename', { name: `Name ${i}` });
    await vi.advanceTimersByTimeAsync(1000);
  }
  expect(starts.length).toBeGreaterThan(0);
  expect(starts[0]! - began).toBeLessThanOrEqual(10000);
  expect((await projects.flush()).ok).toBe(true);
});
test('one write at a time; newer document and view are written immediately afterward', async () => {
  let blocked!: ReturnType<typeof blockFirstSave>;
  const { engine, projects, store, path } = await projectSetup({
    wrap: (repo) => {
      blocked = blockFirstSave(repo);
      return blocked.repo;
    },
  });
  engine.execute('demo.rename', { name: 'First' });
  await vi.advanceTimersByTimeAsync(1500);
  await blocked.started;
  projects.saveView({
    navigatorWidth: 300,
    navigatorTab: 'first',
    contextWidth: 340,
    contextOpen: true,
  });
  engine.execute('demo.rename', { name: 'Newest' });
  projects.saveView({
    navigatorWidth: 420,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
  });
  expect(blocked.requests).toHaveLength(1);
  blocked.release();
  expect((await projects.flush()).ok).toBe(true);
  expect(blocked.requests.map((req) => [req.baseRev, req.rev])).toEqual([
    [0, 1],
    [1, 2],
  ]);
  expect(blocked.max()).toBe(1);
  expect(store.files.get(path)!.doc).toEqual(engine.snapshot().doc);
  expect(store.files.get(path)!.view).toEqual({
    navigatorWidth: 420,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
});
test('stale base_rev reports an error, retains the journal and retries on the next command', async () => {
  const requests: SaveReq[] = [];
  const { engine, projects, statuses, memory, store, path } = await projectSetup({
    wrap: (repo) => ({
      ...repo,
      async save(req) {
        requests.push(req);
        if (requests.length === 1) throw new api.StorageError('unknown', 7);
        await repo.save(req);
      },
    }),
  });
  engine.execute('demo.rename', { name: 'First' });
  expect(await projects.flush()).toEqual({
    ok: false,
    error: { code: 'stale_rev', expected: 0, actual: 7 },
  });
  expect(memory.documentWrites).toBe(0);
  expect(statuses.at(-1)).toMatchObject({ state: 'error' });
  engine.execute('demo.rename', { name: 'Retry' });
  expect(statuses.at(-1)).toMatchObject({ state: 'error' });
  await vi.advanceTimersByTimeAsync(1500);
  expect(requests.map((req) => req.baseRev)).toEqual([0, 0]);
  expect(store.files.get(path)!.journal).toHaveLength(2);
  expect(store.files.get(path)!.doc).toEqual(engine.snapshot().doc);
  expect(statuses.at(-1)).toMatchObject({ state: 'saved', rev: 2 });
});
test('journal entries survive a failed write in their original order', async () => {
  const { engine, projects, memory, store, path } = await projectSetup();
  engine.execute('demo.rename', { name: 'First' });
  memory.failNext('disk_full');
  expect(await projects.flush()).toEqual({
    ok: false,
    error: { code: 'storage', reason: 'disk_full' },
  });
  engine.execute('demo.rename', { name: 'Second' });
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get(path)!.journal.map((row) => row.summary)).toEqual([
    'Rename: First',
    'Rename: Second',
  ]);
});
test('view-only changes save without a document write or rev change', async () => {
  const { engine, projects, memory, store, path } = await projectSetup();
  const view = {
    navigatorWidth: 320,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
  };
  projects.saveView(view);
  view.navigatorWidth = 999;
  expect((await projects.flush()).ok).toBe(true);
  expect(memory.documentWrites).toBe(0);
  expect(memory.viewWrites).toBe(1);
  expect(engine.snapshot().rev).toBe(0);
  expect(store.files.get(path)!.view).toEqual({
    navigatorWidth: 320,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
  expect(store.files.get(path)!.journal).toEqual([]);
});
test('a failed view write stays dirty and can be retried', async () => {
  const { projects, memory, store, path } = await projectSetup();
  projects.saveView({
    navigatorWidth: 320,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
  });
  memory.failNext('disk_full');
  expect((await projects.flush()).ok).toBe(false);
  expect(store.files.get(path)!.view).toBeNull();
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get(path)!.view).toEqual({
    navigatorWidth: 320,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
});

test('context-only changes persist without touching the document revision or journal', async () => {
  const { engine, projects, memory, store, path } = await projectSetup();
  projects.saveView({
    navigatorWidth: 300,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
  });
  expect((await projects.flush()).ok).toBe(true);
  projects.saveView({
    navigatorWidth: 300,
    navigatorTab: 'components',
    contextWidth: 460,
    contextOpen: true,
  });
  expect((await projects.flush()).ok).toBe(true);
  projects.saveView({
    navigatorWidth: 300,
    navigatorTab: 'components',
    contextWidth: 460,
    contextOpen: false,
  });
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get(path)!.view).toEqual({
    navigatorWidth: 300,
    navigatorTab: 'components',
    contextWidth: 460,
    contextOpen: false,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
  expect(memory.viewWrites).toBe(3);
  expect(memory.documentWrites).toBe(0);
  expect(engine.snapshot().rev).toBe(0);
  expect(store.files.get(path)!.journal).toEqual([]);
});
test('close flushes document and view before unloading', async () => {
  const { engine, host, projects, store, path } = await projectSetup();
  engine.execute('demo.rename', { name: 'Last' });
  projects.saveView({
    navigatorWidth: 300,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
  });
  expect(await projects.close()).toEqual({ ok: true, value: undefined });
  expect(host.current()).toBeNull();
  expect(store.files.get(path)!.doc).toMatchObject({ name: 'Last', rev: 1 });
  expect(store.files.get(path)!.view).toEqual({
    navigatorWidth: 300,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
});
test('close during in-flight save waits and reports read_only without unloading', async () => {
  let blocked!: ReturnType<typeof blockFirstSave>;
  const { engine, host, projects, memory, store, path, statuses } = await projectSetup({
    wrap: (repo) => {
      blocked = blockFirstSave(repo);
      return blocked.repo;
    },
  });
  engine.execute('demo.rename', { name: 'Unsaved' });
  await vi.advanceTimersByTimeAsync(1500);
  await blocked.started;
  let settled = false;
  const closing = projects.close().then((result) => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  memory.setReadOnly(path, true);
  blocked.release();
  expect(await closing).toEqual({ ok: false, error: { code: 'storage', reason: 'read_only' } });
  expect(host.current()!.doc.name).toBe('Unsaved');
  expect(store.files.get(path)!.doc).toMatchObject({ name: 'Board', rev: 0 });
  expect(statuses.at(-1)).toMatchObject({ state: 'error', reason: 'read_only' });
  memory.setReadOnly(path, false);
  expect((await projects.close()).ok).toBe(true);
  expect(host.current()).toBeNull();
  expect(store.files.get(path)!.journal).toHaveLength(1);
});
test('50 commands and undos during an in-flight save finish with disk equal to engine', async () => {
  let blocked!: ReturnType<typeof blockFirstSave>;
  const { engine, projects, store, path } = await projectSetup({
    wrap: (repo) => {
      blocked = blockFirstSave(repo);
      return blocked.repo;
    },
  });
  engine.execute('demo.rename', { name: 'First' });
  await vi.advanceTimersByTimeAsync(1500);
  await blocked.started;
  for (let i = 0; i < 50; i++) {
    const result =
      i % 3 === 2 ? engine.undo() : engine.execute('demo.rename', { name: `Burst ${i}` });
    expect(result.ok).toBe(true);
  }
  expect(engine.snapshot().rev).toBe(51);
  expect(blocked.requests).toHaveLength(1);
  blocked.release();
  expect((await projects.flush()).ok).toBe(true);
  const file = store.files.get(path)!;
  expect(file.doc).toEqual(engine.snapshot().doc);
  expect(file.rev).toBe(51);
  expect(file.journal).toHaveLength(51);
  expect(file.journal.filter((row) => row.kind === 'undo')).toHaveLength(16);
  expect(blocked.requests.map((req) => [req.baseRev, req.rev])).toEqual([
    [0, 1],
    [1, 51],
  ]);
  expect(blocked.max()).toBe(1);
});
test('concurrent flush calls join the same write', async () => {
  let blocked!: ReturnType<typeof blockFirstSave>;
  const { engine, projects, memory } = await projectSetup({
    wrap: (repo) => {
      blocked = blockFirstSave(repo);
      return blocked.repo;
    },
  });
  engine.execute('demo.rename', { name: 'Joined' });
  const first = projects.flush();
  const second = projects.flush();
  await blocked.started;
  blocked.release();
  expect((await first).ok).toBe(true);
  expect((await second).ok).toBe(true);
  expect(memory.documentWrites).toBe(1);
  expect(blocked.max()).toBe(1);
});
