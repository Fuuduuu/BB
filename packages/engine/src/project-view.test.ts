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
    store.files.get(path)!.view = {
      navigatorWidth: 420,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: true,
    };
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
        view: {
          navigatorWidth: 420,
          navigatorTab: 'components',
          contextWidth: 340,
          contextOpen: true,
        },
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
          contextWidth: 340,
          contextOpen: true,
        },
      },
    });
    expect(store.files.get(target)!.view).toEqual({
      navigatorWidth: 420,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: true,
    });
  },
);
test('open returns null for a file without a saved view', async () => {
  const { projects, store, path } = await projectSetup({ create: false });
  seed(store, path, newBoardDoc('No view'));
  expect(await projects.open({ path })).toMatchObject({ ok: true, value: { view: null } });
});
test('changing only the board view writes metadata and leaves the document and history unchanged', async () => {
  const { engine, projects, memory, store, path } = await projectSetup();
  const panels = {
    navigatorWidth: 380,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
  };
  projects.saveView(panels);
  expect((await projects.flush()).ok).toBe(true);
  const before = engine.snapshot();
  projects.saveView({ ...panels, boardView: { zoom: 2, pan: { x: -10, y: 11 } } });
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get(path)!.view?.boardView).toEqual({ zoom: 2, pan: { x: -10, y: 11 } });
  expect(engine.snapshot()).toMatchObject({ rev: before.rev, history: before.history });
  expect(memory.documentWrites).toBe(0);
});

test('mutating the returned board view cannot alter the current project view', async () => {
  const { projects, path } = await projectSetup();
  projects.saveView({
    navigatorWidth: 380,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 2, pan: { x: -10, y: 11 } },
  });
  const first = await projects.open({ path });
  if (!first.ok || !first.value.view?.boardView) throw new Error('Expected saved board view');
  first.value.view.boardView.pan.x = 500;
  expect(await projects.open({ path })).toMatchObject({
    ok: true,
    value: { view: { boardView: { zoom: 2, pan: { x: -10, y: 11 } } } },
  });
});

test('opening the already active path returns the current in-memory view', async () => {
  const { projects, path } = await projectSetup();
  projects.saveView({
    navigatorWidth: 380,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
  });
  expect(await projects.open({ path })).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 380,
        navigatorTab: 'log',
        contextWidth: 340,
        contextOpen: true,
      },
    },
  });
});
test('copy returns the newest unsaved in-memory view without sharing its reference', async () => {
  const { projects, store } = await projectSetup();
  projects.saveView({
    navigatorWidth: 500,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
  });
  const copied = await projects.copy({ dest: 'Copy.pcbk', identity: 'same' });
  expect(copied).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 500,
        navigatorTab: 'log',
        contextWidth: 340,
        contextOpen: true,
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
        contextWidth: 340,
        contextOpen: true,
      },
    },
  });
  expect(store.files.get('Copy.pcbk')!.view).toEqual({
    navigatorWidth: 500,
    navigatorTab: 'log',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
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
  projects.saveView({
    navigatorWidth: 320,
    navigatorTab: 'old',
    contextWidth: 340,
    contextOpen: true,
  });
  const copying = projects.copy({ dest: 'Copy.pcbk', identity: 'new' });
  await started.promise;
  projects.saveView({
    navigatorWidth: 640,
    navigatorTab: 'latest',
    contextWidth: 340,
    contextOpen: true,
  });
  release.resolve();
  expect(await copying).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 640,
        navigatorTab: 'latest',
        contextWidth: 340,
        contextOpen: true,
      },
    },
  });
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get('Copy.pcbk')!.view).toEqual({
    navigatorWidth: 640,
    navigatorTab: 'latest',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
});
test('copy activation cannot overwrite a newer view supplied by a status observer', async () => {
  const { projects, store } = await projectSetup();
  projects.saveView({
    navigatorWidth: 360,
    navigatorTab: 'copied',
    contextWidth: 340,
    contextOpen: true,
  });
  let changed = false;
  projects.status((status) => {
    if (changed || status.state !== 'saved') return;
    changed = true;
    projects.saveView({
      navigatorWidth: 700,
      navigatorTab: 'observer',
      contextWidth: 340,
      contextOpen: true,
    });
  });
  expect(await projects.copy({ dest: 'Copy.pcbk', identity: 'new' })).toMatchObject({
    ok: true,
    value: {
      view: {
        navigatorWidth: 700,
        navigatorTab: 'observer',
        contextWidth: 340,
        contextOpen: true,
      },
    },
  });
  expect((await projects.flush()).ok).toBe(true);
  expect(store.files.get('Copy.pcbk')!.view).toEqual({
    navigatorWidth: 700,
    navigatorTab: 'observer',
    contextWidth: 340,
    contextOpen: true,
    boardView: { zoom: 1, pan: { x: 0, y: 0 } },
  });
});
