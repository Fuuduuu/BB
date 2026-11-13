import { MIGRATIONS, newBoardDoc } from '@pcbk/domain';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { blockFirstSave, deferred, projectSetup, seed } from './__tests__/project-helpers';
import * as storage from '../../adapters/src/storage-memory';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test('create, close and reopen preserve content but start a fresh history and session', async () => {
  const { engine, host, projects, path } = await projectSetup();
  const firstSession = host.current()!.sessionId;
  engine.execute('demo.rename', { name: 'Renamed' });
  await projects.close();
  const reopened = await projects.open({ path });
  expect(reopened).toMatchObject({ ok: true, value: { name: 'Renamed', path, readOnly: false } });
  expect(host.current()!.sessionId).not.toBe(firstSession);
  expect(engine.snapshot().doc.name).toBe('Renamed');
  expect(engine.undo()).toEqual({ ok: false, error: { code: 'not_found', id: 'undo' } });
});
test('create validates a trimmed name before creating a file', async () => {
  const { projects, host, store } = await projectSetup({ create: false });
  expect(await projects.create({ name: '   ' })).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(store.files.size).toBe(0);
  expect(host.current()).toBeNull();
  expect((await projects.create({ name: ' Board ' })).ok).toBe(true);
  expect(host.current()!.doc.name).toBe('Board');
});
test('opening the active path keeps its history and engine session', async () => {
  const { engine, host, projects, path } = await projectSetup();
  engine.execute('demo.rename', { name: 'Changed' });
  const session = host.current()!.sessionId;
  expect((await projects.open({ path })).ok).toBe(true);
  expect(host.current()!.sessionId).toBe(session);
  expect(engine.undo().ok).toBe(true);
});
test('a failed new open keeps the previous project loaded', async () => {
  const { engine, host, projects } = await projectSetup();
  engine.execute('demo.rename', { name: 'Kept' });
  const session = host.current()!.sessionId;
  expect(await projects.open({ path: 'missing.pcbk' })).toEqual({
    ok: false,
    error: { code: 'storage', reason: 'missing' },
  });
  expect(host.current()!.sessionId).toBe(session);
  expect(engine.snapshot().doc.name).toBe('Kept');
  expect(engine.undo().ok).toBe(true);
});
test('backups with projectId lists without an open project', async () => {
  const { projects, repo, path, host } = await projectSetup();
  expect((await projects.close()).ok).toBe(true);
  const opened = await repo.open(path);
  await repo.backupFull(opened.session, 'migration');
  await repo.close(opened.session);
  const backups = await repo.backups(opened.projectId);
  expect(backups).toHaveLength(1);

  expect(await projects.backups({ projectId: opened.projectId })).toEqual({
    ok: true,
    value: backups,
  });
  expect(host.current()).toBeNull();
});
test('backups without request still needs an open project', async () => {
  const { projects } = await projectSetup({ create: false });
  expect(await projects.backups()).toEqual({ ok: false, error: { code: 'stale_session' } });
});
test('newer format returns too_new, leaves engine unloaded and releases the failed open lock', async () => {
  const { projects, host, store, path } = await projectSetup({ create: false });
  seed(store, path, { ...newBoardDoc('Future'), format_version: 2 }, 2);
  expect(await projects.open({ path })).toEqual({
    ok: false,
    error: { code: 'storage', reason: 'too_new' },
  });
  expect(host.current()).toBeNull();
  const other = storage.createMemoryRepository(store);
  await expect(other.open(path)).resolves.toMatchObject({ formatVersion: 2 });
});
test('invalid current document returns not_project and does not load', async () => {
  const { projects, host, store, path } = await projectSetup({ create: false });
  seed(store, path, { format_version: 1, rev: 0, name: 'Broken' });
  expect(await projects.open({ path })).toEqual({
    ok: false,
    error: { code: 'storage', reason: 'not_project' },
  });
  expect(host.current()).toBeNull();
  expect(store.locks.size).toBe(0);
});
test('older format is backed up before the real migration and persisted by flush', async () => {
  const calls: string[] = [];
  const { projects, host, store, path } = await projectSetup({
    create: false,
    wrap: (repo) => ({
      ...repo,
      async open(path) {
        calls.push('open');
        return repo.open(path);
      },
      async backupFull(session, reason) {
        calls.push(`backupFull:${reason}`);
        await repo.backupFull(session, reason);
      },
    }),
  });
  seed(store, path, { ...newBoardDoc('Legacy'), format_version: 0 }, 0);
  const previous = [...MIGRATIONS];
  MIGRATIONS.push({
    from: 0,
    up(raw) {
      calls.push('migrate');
      return { ...(raw as object), format_version: 1 };
    },
  });
  try {
    expect((await projects.open({ path })).ok).toBe(true);
    expect(calls).toEqual(['open', 'backupFull:migration', 'migrate']);
    expect(host.current()!.doc.format_version).toBe(1);
    expect(store.files.get(path)!.formatVersion).toBe(0);
    expect((await projects.backups()).ok).toBe(true);
    expect(store.backups.size).toBe(1);
    expect((await projects.flush()).ok).toBe(true);
    expect(store.files.get(path)!.formatVersion).toBe(1);
  } finally {
    MIGRATIONS.splice(0, MIGRATIONS.length, ...previous);
  }
});
test('read-only old format is never migrated or backed up as a writable open', async () => {
  const { projects, host, store, path } = await projectSetup({ create: false });
  seed(store, path, { ...newBoardDoc('Legacy'), format_version: 0 }, 0, true);
  expect(await projects.open({ path })).toEqual({
    ok: false,
    error: { code: 'storage', reason: 'read_only' },
  });
  expect(host.current()).toBeNull();
  expect(store.backups.size).toBe(0);
});
test('second open of the same file is locked until the first project closes', async () => {
  const { projects, store, path } = await projectSetup();
  const other = storage.createMemoryRepository(store);
  await expect(other.open(path)).rejects.toMatchObject({ reason: 'locked' });
  await projects.close();
  await expect(other.open(path)).resolves.toMatchObject({ path });
});
test('open shows last save time, not open time', async () => {
  vi.setSystemTime(new Date('2026-11-08T09:00:00Z'));
  const { engine, projects, path, statuses } = await projectSetup();
  const savedAt = '2026-11-08T10:00:00.000Z';
  vi.setSystemTime(new Date(savedAt));
  engine.execute('demo.rename', { name: 'Saved' });
  expect((await projects.flush()).ok).toBe(true);
  expect((await projects.close()).ok).toBe(true);

  vi.setSystemTime(new Date('2026-11-08T13:00:00Z'));
  const opened = await projects.open({ path });
  expect(opened).toMatchObject({ ok: true, value: { name: 'Saved' } });
  expect(statuses.at(-1)).toMatchObject({ state: 'saved', rev: 1, at: savedAt });
});
test('discard releases the repository session without saving', async () => {
  const { engine, host, projects, memory, store, path } = await projectSetup();
  engine.execute('demo.rename', { name: 'Discarded' });
  projects.saveView({
    navigatorWidth: 340,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
  });
  expect((await projects.discard()).ok).toBe(true);
  expect(host.current()).toBeNull();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(memory.documentWrites).toBe(0);
  expect(memory.viewWrites).toBe(0);

  const other = storage.createMemoryRepository(store);
  const reopened = await other.open(path);
  expect(reopened).toMatchObject({ doc: { name: 'Board', rev: 0 }, view: null });
  await other.close(reopened.session);
});
test('discard waits for an in-flight write and skips queued changes', async () => {
  let saving!: ReturnType<typeof blockFirstSave>;
  const { engine, host, projects, store, path } = await projectSetup({
    timing: { debounceMs: 10, maxWaitMs: 100 },
    wrap(repo) {
      saving = blockFirstSave(repo);
      return saving.repo;
    },
  });
  engine.execute('demo.rename', { name: 'Writing' });
  await vi.advanceTimersByTimeAsync(10);
  await saving.started;
  engine.execute('demo.rename', { name: 'Discarded' });
  const discarding = projects.discard();
  await vi.advanceTimersByTimeAsync(0);

  const other = storage.createMemoryRepository(store);
  await expect(other.open(path)).rejects.toMatchObject({ reason: 'locked' });
  saving.release();
  expect((await discarding).ok).toBe(true);
  expect(host.current()).toBeNull();
  await vi.advanceTimersByTimeAsync(100);
  expect(saving.requests).toHaveLength(1);
  const reopened = await other.open(path);
  expect(reopened.doc).toMatchObject({ name: 'Writing', rev: 1 });
  await other.close(reopened.session);
});
test('old timers and statuses do not affect a reopened session', async () => {
  const { engine, projects, host, store, path, statuses } = await projectSetup();
  engine.execute('demo.rename', { name: 'Pending old' });
  const oldSession = host.current()!.sessionId;
  seed(store, 'Other.pcbk', newBoardDoc('Other'));
  expect((await projects.open({ path: 'Other.pcbk' })).ok).toBe(true);
  const afterOpen = statuses.length;
  await vi.advanceTimersByTimeAsync(20000);
  expect(statuses.slice(afterOpen).some((status) => status.sessionId === oldSession)).toBe(false);
  expect(store.files.get(path)!.doc).toMatchObject({ name: 'Pending old' });
  expect(engine.snapshot().doc.name).toBe('Other');
});
test('copy rescues unsaved data after a storage failure without changing the original file', async () => {
  const { engine, projects, memory, store, path } = await projectSetup();
  engine.execute('demo.rename', { name: 'Rescued' });
  projects.saveView({
    navigatorWidth: 340,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
  });
  memory.failNext('disk_full');
  expect((await projects.flush()).ok).toBe(false);
  const originalId = store.files.get(path)!.projectId;
  expect(await projects.copy({ dest: 'Rescue.pcbk', identity: 'same' })).toMatchObject({
    ok: true,
    value: { path: 'Rescue.pcbk', projectId: originalId },
  });
  expect(store.files.get('Rescue.pcbk')!.doc).toEqual(engine.snapshot().doc);
  expect(store.files.get('Rescue.pcbk')!.view).toEqual({
    navigatorWidth: 340,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
    modules: {},
  });
  expect(store.files.get('Rescue.pcbk')!.journal).toHaveLength(1);
  expect(store.files.get(path)!.doc).toMatchObject({ name: 'Board', rev: 0 });
  expect(engine.undo().ok).toBe(true);
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get('Rescue.pcbk')!.doc).toMatchObject({ name: 'Board', rev: 2 });
});
test('commands during copy are retained and saved into the new file', async () => {
  const started = deferred();
  const release = deferred();
  const { engine, projects, store, path } = await projectSetup({
    wrap: (repo) => ({
      ...repo,
      async copy(req) {
        started.resolve();
        await release.promise;
        return repo.copy(req);
      },
    }),
  });
  engine.execute('demo.rename', { name: 'Copied' });
  const copying = projects.copy({ dest: 'New.pcbk', identity: 'new' });
  await started.promise;
  engine.execute('demo.rename', { name: 'Later' });
  projects.saveView({
    navigatorWidth: 380,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
  });
  release.resolve();
  expect((await copying).ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Later');
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get('New.pcbk')!.doc).toEqual(engine.snapshot().doc);
  expect(store.files.get('New.pcbk')!.view).toEqual({
    navigatorWidth: 380,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
    modules: {},
  });
  expect(store.files.get('New.pcbk')!.journal).toHaveLength(2);
  expect(store.files.get('New.pcbk')!.projectId).not.toBe(store.files.get(path)!.projectId);
});
