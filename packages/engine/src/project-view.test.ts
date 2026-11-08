import { newBoardDoc } from '@pcbk/domain';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { deferred, projectSetup, seed } from './__tests__/project-helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test('create returns null when the new file has no saved view', async () => {
  const { projects } = await projectSetup({ create: false });
  expect(await projects.create({ name: 'New' })).toMatchObject({ ok: true, value: { view: null } });
});
test.each(['open', 'restore'] as const)(
  '%s returns the saved view as a detached value',
  async (operation) => {
    const { projects, memory, store, path } = await projectSetup({ create: false });
    seed(store, path, newBoardDoc('Saved'));
    store.files.get(path)!.view = { navigatorWidth: 420, navigatorTab: 'components' };
    let target = path;
    let result;
    if (operation === 'restore') {
      const source = await memory.open(path);
      await memory.backupFull(source.session, 'migration');
      await memory.close(source.session);
      const [backup] = await memory.backups(source.projectId);
      target = 'Restored.pcbk';
      result = await projects.restore({ backup: backup!.file, dest: target });
    } else result = await projects.open({ path });
    expect(result).toMatchObject({
      ok: true,
      value: {
        path: target,
        view: { navigatorWidth: 420, navigatorTab: 'components' },
      },
    });
    if (!result.ok) throw new Error('Expected opened project');
    result.value.view!.navigatorWidth = 999;
    const again = await projects.open({ path: target });
    expect(again).toMatchObject({
      ok: true,
      value: {
        view: {
          navigatorWidth: 420,
          navigatorTab: 'components',
        },
      },
    });
    expect(store.files.get(target)!.view).toEqual({
      navigatorWidth: 420,
      navigatorTab: 'components',
    });
  },
);
test('open returns null for a file without a saved view', async () => {
  const { projects, store, path } = await projectSetup({ create: false });
  seed(store, path, newBoardDoc('No view'));
  expect(await projects.open({ path })).toMatchObject({ ok: true, value: { view: null } });
});
test('opening the already active path returns the current in-memory view', async () => {
  const { projects, path } = await projectSetup();
  projects.saveView({ navigatorWidth: 380, navigatorTab: 'log' });
  expect(await projects.open({ path })).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 380,
        navigatorTab: 'log',
      },
    },
  });
});
test('copy returns the newest unsaved in-memory view without sharing its reference', async () => {
  const { projects, store } = await projectSetup();
  projects.saveView({ navigatorWidth: 500, navigatorTab: 'log' });
  const copied = await projects.copy({ dest: 'Copy.pcbk', identity: 'same' });
  expect(copied).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 500,
        navigatorTab: 'log',
      },
    },
  });
  if (!copied.ok) throw new Error('Expected copied project');
  copied.value.view!.navigatorWidth = 999;
  expect(await projects.open({ path: 'Copy.pcbk' })).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 500,
        navigatorTab: 'log',
      },
    },
  });
  expect(store.files.get('Copy.pcbk')!.view).toEqual({ navigatorWidth: 500, navigatorTab: 'log' });
});
test('copy response includes a view changed while the copy was awaiting storage', async () => {
  const started = deferred();
  const release = deferred();
  const { projects, store } = await projectSetup({
    wrap: (repo) => ({
      ...repo,
      async copy(req) {
        started.resolve();
        await release.promise;
        return repo.copy(req);
      },
    }),
  });
  projects.saveView({ navigatorWidth: 320, navigatorTab: 'old' });
  const copying = projects.copy({ dest: 'Copy.pcbk', identity: 'new' });
  await started.promise;
  projects.saveView({ navigatorWidth: 640, navigatorTab: 'latest' });
  release.resolve();
  expect(await copying).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 640,
        navigatorTab: 'latest',
      },
    },
  });
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get('Copy.pcbk')!.view).toEqual({
    navigatorWidth: 640,
    navigatorTab: 'latest',
  });
});
test('copy activation cannot overwrite a newer view supplied by a status observer', async () => {
  const { projects, store } = await projectSetup();
  projects.saveView({ navigatorWidth: 360, navigatorTab: 'copied' });
  let changed = false;
  projects.status((status) => {
    if (changed || status.state !== 'saved') return;
    changed = true;
    projects.saveView({ navigatorWidth: 700, navigatorTab: 'observer' });
  });
  expect(await projects.copy({ dest: 'Copy.pcbk', identity: 'new' })).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 700,
        navigatorTab: 'observer',
      },
    },
  });
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get('Copy.pcbk')!.view).toEqual({
    navigatorWidth: 700,
    navigatorTab: 'observer',
  });
});
