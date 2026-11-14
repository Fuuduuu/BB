import { newBoardDoc } from '@pcbk/domain';
import type { CommandOk, EngineError, Result } from '@pcbk/contracts';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { deferred, projectSetup, seed } from './__tests__/project-helpers';
import { StorageError } from './ports';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test('invalid save timing is rejected when constructing the service, before opening a file', async () => {
  await expect(
    projectSetup({ create: false, timing: { debounceMs: 0, maxWaitMs: 10 } }),
  ).rejects.toThrow('invalid_save_timing');
});

test.each(['close', 'open'] as const)(
  '%s persists every accepted old-session command at the final Promise boundary',
  async (operation) => {
    for (let depth = 0; depth < 13; depth++) {
      const { engine, host, projects, store, path } = await projectSetup();
      seed(store, 'Other.pcbk', newBoardDoc('Other'));
      const oldSession = host.current()!.sessionId;
      const finished = deferred();
      let late: Result<CommandOk, EngineError> | undefined;
      let atSession: string | undefined;
      let scheduled = false;
      projects.status((status) => {
        if (
          scheduled ||
          status.state !== 'saved' ||
          status.rev !== 1 ||
          status.sessionId !== oldSession
        )
          return;
        scheduled = true;
        let continuation = Promise.resolve();
        for (let step = 0; step < depth; step++) continuation = continuation.then(() => undefined);
        void continuation.then(() => {
          atSession = host.current()?.sessionId;
          late = engine.execute('demo.rename', { name: 'Late' });
          finished.resolve();
        });
      });
      engine.execute('demo.rename', { name: 'Saved' });
      const result =
        operation === 'close'
          ? await projects.close()
          : await projects.open({ path: 'Other.pcbk' });
      expect(result.ok).toBe(true);
      await finished.promise;
      if (late!.ok && atSession === oldSession) {
        expect(store.files.get(path)!.doc, `depth ${depth}`).toMatchObject({
          name: 'Late',
          rev: 2,
        });
        expect(store.files.get(path)!.journal, `depth ${depth}`).toHaveLength(2);
      } else if (operation === 'close') {
        expect(late).toMatchObject({ ok: false, error: { code: 'stale_session' } });
      }
      if (operation === 'open') await projects.close();
    }
  },
);
test('a failed handle release retains its token and retry actually releases the file', async () => {
  let attempts = 0;
  const { engine, projects, store, path } = await projectSetup({
    wrap: (repo) => ({
      ...repo,
      async close(session) {
        if (++attempts === 1) throw new StorageError('unknown');
        await repo.close(session);
      },
    }),
  });
  engine.execute('demo.rename', { name: 'Saved' });
  expect(await projects.close()).toEqual({
    ok: false,
    error: { code: 'storage', reason: 'unknown' },
  });
  expect(store.locks.size).toBe(1);
  expect(engine.execute('demo.rename', { name: 'Too late' })).toMatchObject({ ok: false });
  expect((await projects.close()).ok).toBe(true);
  expect(store.locks.size).toBe(0);
  expect((await projects.open({ path })).ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Saved');
});
test.each(['open', 'copy'] as const)(
  '%s retains a failed old-handle release and reports it until retry',
  async (operation) => {
    let attempts = 0;
    const { engine, projects, store, path, statuses } = await projectSetup({
      wrap: (repo) => ({
        ...repo,
        async close(session) {
          if (++attempts === 1) throw new StorageError('unknown');
          await repo.close(session);
        },
      }),
    });
    seed(store, 'Other.pcbk', newBoardDoc('Other'));
    engine.execute('demo.rename', { name: 'Saved' });
    const result =
      operation === 'open'
        ? await projects.open({ path: 'Other.pcbk' })
        : await projects.copy({ dest: 'Copy.pcbk', identity: 'new' });
    expect(result.ok).toBe(true);
    expect(statuses.at(-1)).toMatchObject({ state: 'error', reason: 'unknown' });
    expect(store.locks.has(path)).toBe(true);
    expect((await projects.flush()).ok).toBe(true);
    expect(store.locks.has(path)).toBe(false);
    expect(statuses.at(-1)).toMatchObject({ state: 'saved' });
    expect((await projects.close()).ok).toBe(true);
    expect(store.locks.size).toBe(0);
  },
);
test.each(['close', 'open'] as const)(
  'read-only viewing does not block %s or write a view',
  async (operation) => {
    const { projects, memory, store, path } = await projectSetup({ create: false });
    seed(store, path, newBoardDoc('Readonly'), 1, true);
    seed(store, 'Other.pcbk', newBoardDoc('Other'));
    expect((await projects.open({ path })).ok).toBe(true);
    projects.saveView({
      navigatorWidth: 480,
      navigatorOpen: true,
      navigatorTab: 'log',
      contextWidth: 340,
      contextOpen: true,
    });
    const result =
      operation === 'close' ? await projects.close() : await projects.open({ path: 'Other.pcbk' });
    expect(result.ok).toBe(true);
    expect(memory.documentWrites).toBe(0);
    expect(memory.viewWrites).toBe(0);
    expect(store.files.get(path)!.view).toBeNull();
  },
);
test('an ephemeral read-only view is kept in a new writable rescue copy', async () => {
  const { engine, projects, store, path } = await projectSetup({ create: false });
  seed(store, path, newBoardDoc('Readonly'), 1, true);
  await projects.open({ path });
  projects.saveView({
    navigatorWidth: 480,
    navigatorOpen: true,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
  });
  expect(await projects.copy({ dest: 'Writable.pcbk', identity: 'same' })).toMatchObject({
    ok: true,
    value: { readOnly: false, path: 'Writable.pcbk' },
  });
  expect(store.files.get('Writable.pcbk')!.view).toEqual({
    navigatorWidth: 480,
    navigatorOpen: true,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
    modules: {},
  });
  expect(engine.execute('demo.rename', { name: 'Editable' }).ok).toBe(true);
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get('Writable.pcbk')!.doc).toMatchObject({ name: 'Editable' });
});
