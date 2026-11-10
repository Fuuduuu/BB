// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import type { AppHost, RecentProject } from '@pcbk/contracts';
import { uiFeatures } from '@pcbk/features/ui';
import { et, useSessionStore, useViewStore, Workbench } from '@pcbk/ui';
import type { ComponentProps } from 'react';
import { createRuntime } from './runtime';
import type { Runtime } from './runtime';

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

afterEach(() => {
  cleanup();
  useViewStore.getState().reset();
  vi.restoreAllMocks();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

function fakeHost(recents: RecentProject[] = []) {
  const unsubscribeClose = vi.fn();
  const host = {
    kind: 'web',
    recents: vi.fn<AppHost['recents']>().mockResolvedValue(recents),
    removeRecent: vi.fn<AppHost['removeRecent']>().mockResolvedValue(undefined),
    onCloseRequested: vi.fn<AppHost['onCloseRequested']>(() => unsubscribeClose),
    onOpenPath: vi.fn<AppHost['onOpenPath']>(() => vi.fn()),
    closeNow: vi.fn(),
    reload: vi.fn(),
    saveDiagnostics: vi.fn<AppHost['saveDiagnostics']>().mockResolvedValue(undefined),
  } satisfies AppHost;
  return { host, unsubscribeClose };
}

function mount(
  runtime: Runtime,
  host: AppHost,
  uiModules: ComponentProps<typeof Workbench>['uiModules'] = () => [],
) {
  return render(
    <EngineProvider engine={runtime.engine} projects={runtime.projects}>
      <Workbench host={host} uiModules={uiModules} />
    </EngineProvider>,
  );
}

async function seedProject(runtime: Runtime, name: string) {
  const created = await runtime.projects.create({ name });
  if (!created.ok) throw new Error(`Could not create a test project: ${created.error.code}`);
  expect((await runtime.projects.close()).ok).toBe(true);
  return created.value;
}

test('view_only_change_leaves_document_rev_unchanged', async () => {
  const runtime = createRuntime();
  const project = await seedProject(runtime, 'Lõuendi vaate proov');
  const { host } = fakeHost();
  const app = mount(runtime, host);
  const openPath = host.onOpenPath.mock.lastCall?.[0];
  if (!openPath) throw new Error('Workbench did not register an open-path handler');
  await act(async () => openPath(project.path));
  expect(await screen.findByText(project.name)).toBeTruthy();

  try {
    const before = runtime.engine.snapshot();
    const canvas = screen.getByRole('main', { name: et.shell.canvas }).querySelector('svg')!;
    Object.defineProperty(canvas, 'getScreenCTM', {
      value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
    });
    fireEvent.wheel(canvas, { clientX: 120, clientY: 18, deltaY: -Math.log(2) / 0.002 });
    expect(canvas.querySelector('[data-view]')?.getAttribute('transform')).toBe(
      'matrix(2 0 0 2 -120 -18)',
    );
    expect(useViewStore.getState().boardView).toEqual({ zoom: 2, pan: { x: -120, y: -18 } });
    await act(async () => expect((await runtime.projects.flush()).ok).toBe(true));
    expect(runtime.engine.snapshot()).toMatchObject({ rev: before.rev, history: before.history });
  } finally {
    app.unmount();
    await runtime.projects.close();
  }
  const reopened = await runtime.projects.open({ path: project.path });
  try {
    expect(reopened).toMatchObject({
      ok: true,
      value: { view: { boardView: { zoom: 2, pan: { x: -120, y: -18 } } } },
    });
  } finally {
    await runtime.projects.close();
  }
});

test('workbench uses only AppHost for recents, open list and close', async () => {
  const runtime = createRuntime();
  const project = await seedProject(runtime, 'Prooviplaat');
  const updatedAt = '2026-11-09T09:30:00Z';
  const missing: RecentProject = {
    path: 'web://missing',
    projectId: 'missing',
    name: 'Hosti kadunud plaat',
    updatedAt,
    missing: true,
  };
  const { host, unsubscribeClose } = fakeHost([missing]);
  host.removeRecent.mockImplementation(async () => {
    host.recents.mockResolvedValue([]);
  });
  const available: RecentProject = {
    path: project.path,
    projectId: project.projectId,
    name: 'Hosti projektide loendist',
    updatedAt,
  };
  const listOpenable = vi.fn<NonNullable<AppHost['listOpenable']>>().mockResolvedValue([available]);

  const app = mount(runtime, { ...host, listOpenable });
  expect(await screen.findByText(missing.name)).toBeTruthy();
  expect(host.recents).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: et.project.removeRecent }));
  await waitFor(() => expect(screen.queryByText(missing.name)).toBeNull());
  expect(host.removeRecent).toHaveBeenCalledExactlyOnceWith(missing.path);

  fireEvent.click(screen.getByRole('button', { name: et.project.open }));
  const list = await screen.findByRole('dialog', { name: et.project.openTitle });
  fireEvent.click(
    await within(list).findByRole('button', { name: et.project.openNamed(available.name) }),
  );
  expect(listOpenable).toHaveBeenCalled();
  expect(await screen.findByText(project.name)).toBeTruthy();

  const requestClose = host.onCloseRequested.mock.lastCall?.[0];
  if (!requestClose) throw new Error('Workbench did not register a close handler');
  await act(async () => expect(await requestClose()).toBe(true));
  expect(runtime.engine.snapshot().sessionId).toBeFalsy();
  const unsubscribedBeforeUnmount = unsubscribeClose.mock.calls.length;
  app.unmount();
  expect(unsubscribeClose).toHaveBeenCalledTimes(unsubscribedBeforeUnmount + 1);
});

test('missing optional host methods disable their buttons', async () => {
  const runtime = createRuntime();
  const project = await seedProject(runtime, 'Kirjutuskaitstud prooviplaat');
  const { host } = fakeHost();
  const app = mount(runtime, host);

  const open = screen.getByRole<HTMLButtonElement>('button', {
    name: et.project.open,
    description: /\S/,
  });
  expect(open.disabled).toBe(true);
  fireEvent.click(open);
  expect(screen.queryByRole('dialog', { name: et.project.openTitle })).toBeNull();

  const openPath = host.onOpenPath.mock.lastCall?.[0];
  if (!openPath) throw new Error('Workbench did not register an open-path handler');
  await act(async () => openPath(project.path));
  expect(await screen.findByText(project.name)).toBeTruthy();
  const close = vi.spyOn(runtime.projects, 'close').mockResolvedValue({
    ok: false,
    error: { code: 'storage', reason: 'read_only' },
  });
  const requestClose = host.onCloseRequested.mock.lastCall?.[0];
  if (!requestClose) throw new Error('Workbench did not register a close handler');
  await act(async () => expect(await requestClose()).toBe(false));

  const dialog = await screen.findByRole('dialog', {
    name: et.save.closeTitle(et.reason.read_only),
  });
  const save = within(dialog).getByRole<HTMLButtonElement>('button', {
    name: et.common.saveElsewhere,
  });
  expect(save.disabled).toBe(true);
  expect(save.title).toBe(et.project.copyUnavailable);
  expect(host.closeNow).not.toHaveBeenCalled();

  app.unmount();
  close.mockRestore();
  expect((await runtime.projects.close()).ok).toBe(true);
});

const restoreSource: RecentProject = {
  path: 'C:/projects/source.pcbk',
  projectId: 'project_source',
  name: 'Algne plaat',
  updatedAt: '2026-11-09T09:30:00Z',
};
const restoreList = [
  { file: 'C:/backups/older.pcbk', kind: 'full' as const, at: '2026-11-08T09:30:00Z' },
  { file: 'C:/backups/latest.pcbk', kind: 'doc' as const, at: '2026-11-09T09:30:00Z' },
];

function mountRestore(runtime: Runtime, dest: string | null, source = restoreSource) {
  const { host } = fakeHost([source]);
  const pickSavePath = vi.fn<NonNullable<AppHost['pickSavePath']>>().mockResolvedValue(dest);
  const backups = vi
    .spyOn(runtime.projects, 'backups')
    .mockResolvedValue({ ok: true, value: restoreList });
  const restore = vi.spyOn(runtime.projects, 'restore');
  const app = mount(runtime, { ...host, kind: 'desktop', pickSavePath });
  return { app, host, pickSavePath, backups, restore };
}

async function openRestoreDialog() {
  const button = await screen.findByRole<HTMLButtonElement>('button', { name: et.project.restore });
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  const dialog = within(await screen.findByRole('dialog', { name: 'Taasta varukoopiast' }));
  const choices = await dialog.findAllByRole<HTMLInputElement>('radio');
  return { dialog, choices, confirm: dialog.getByRole('button', { name: 'Taasta' }) };
}

test('restore button is disabled without host support', async () => {
  const { host } = fakeHost([restoreSource]);
  mount(createRuntime(), { ...host, kind: 'desktop' });
  const button = await screen.findByRole<HTMLButtonElement>('button', { name: et.project.restore });
  expect(button.disabled).toBe(true);
  expect(button.title).toBe(et.project.restoreUnavailable);
});

test('restore dialog lists backups newest first and restores into a chosen file', async () => {
  const runtime = createRuntime();
  const restored = await seedProject(runtime, 'Taastatud plaat');
  const { app, host, pickSavePath, backups, restore } = mountRestore(runtime, restored.path);
  restore.mockImplementation(({ dest }) => runtime.projects.open({ path: dest }));

  try {
    const { choices, confirm } = await openRestoreDialog();
    expect(backups).toHaveBeenCalledExactlyOnceWith({ projectId: restoreSource.projectId });
    expect(choices.map((choice) => choice.checked)).toEqual([true, false]);
    expect(choices[0]?.labels?.[0]?.textContent).toContain('Muudatuste koopia');
    expect(choices[1]?.labels?.[0]?.textContent).toContain('Täiskoopia');
    fireEvent.click(choices[1]!);
    fireEvent.click(confirm);

    expect(await screen.findByText(restored.name)).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Taasta varukoopiast' })).toBeNull();
    expect(pickSavePath).toHaveBeenCalledExactlyOnceWith('Algne plaat (taastatud)');
    expect(restore).toHaveBeenCalledExactlyOnceWith({
      backup: restoreList[0]!.file,
      dest: restored.path,
    });
    expect(host.recents).toHaveBeenCalledTimes(2);
  } finally {
    app.unmount();
    await runtime.projects.close();
  }
});

test('restore cancelled in save dialog does nothing', async () => {
  const { pickSavePath, restore } = mountRestore(createRuntime(), null);
  const { confirm } = await openRestoreDialog();
  await act(async () => fireEvent.click(confirm));
  expect(pickSavePath).toHaveBeenCalledOnce();
  expect(restore).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Taasta varukoopiast' })).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('restore failure keeps the start screen and shows the message', async () => {
  const { restore } = mountRestore(createRuntime(), restoreSource.path);
  restore.mockResolvedValue({ ok: false, error: { code: 'storage', reason: 'locked' } });
  const { dialog, confirm } = await openRestoreDialog();
  fireEvent.click(confirm);
  expect((await dialog.findByRole('alert')).textContent).toContain(
    'Taastamine ebaõnnestus. Algne projekt on muutmata.',
  );
  expect(screen.getByRole('heading', { name: et.appName })).toBeTruthy();
});

test('restore_conflict_keeps_choice_and_retries_with_new_name', async () => {
  const runtime = createRuntime();
  const restored = await seedProject(runtime, 'Uue nimega taastatud plaat');
  const { app, pickSavePath, backups, restore } = mountRestore(runtime, restored.path);
  pickSavePath.mockResolvedValueOnce(restoreSource.path);
  restore
    .mockResolvedValueOnce({ ok: false, error: { code: 'storage', reason: 'exists' } })
    .mockImplementation(({ dest }) => runtime.projects.open({ path: dest }));
  try {
    const { dialog, choices, confirm } = await openRestoreDialog();
    const backup = restoreList[0]!.file;
    fireEvent.click(choices[1]!);
    fireEvent.click(confirm);
    expect((await dialog.findByRole('alert')).textContent).toBe(
      'See failinimi on juba kasutusel. Vali uus failinimi.',
    );
    expect(choices[1]?.checked).toBe(true);
    expect(confirm.hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirm);

    expect(await screen.findByText(restored.name)).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: et.project.restoreTitle })).toBeNull();
    expect(pickSavePath).toHaveBeenCalledTimes(2);
    expect(backups).toHaveBeenCalledOnce();
    expect(restore.mock.calls).toEqual([
      [{ backup, dest: restoreSource.path }],
      [{ backup, dest: restored.path }],
    ]);
  } finally {
    app.unmount();
    await runtime.projects.close();
  }
});

test('missing project card can still be restored', async () => {
  const runtime = createRuntime();
  const recovered = await seedProject(runtime, 'Kadunud plaat taastatud');
  const { app, restore } = mountRestore(runtime, recovered.path, {
    ...restoreSource,
    missing: true,
  });
  restore.mockImplementation(({ dest }) => runtime.projects.open({ path: dest }));
  try {
    const missing = await screen.findByRole<HTMLButtonElement>('button', {
      name: et.project.openNamed(restoreSource.name),
    });
    expect(missing.disabled).toBe(true);
    const { confirm } = await openRestoreDialog();
    fireEvent.click(confirm);
    expect(await screen.findByText(recovered.name)).toBeTruthy();
    expect(restore).toHaveBeenCalledExactlyOnceWith({
      backup: restoreList[1]!.file,
      dest: recovered.path,
    });
  } finally {
    app.unmount();
    await runtime.projects.close();
  }
});

test('native close waits for a pending open and takes priority over another open', async () => {
  const runtime = createRuntime();
  const project = await seedProject(runtime, 'Avamisel olev prooviplaat');
  const openProject = runtime.projects.open.bind(runtime.projects);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const opening = vi.spyOn(runtime.projects, 'open').mockImplementationOnce(async (request) => {
    await barrier;
    return openProject(request);
  });
  const close = vi.spyOn(runtime.projects, 'close');
  const { host } = fakeHost();
  mount(runtime, { ...host, kind: 'desktop' });
  const openPath = host.onOpenPath.mock.lastCall?.[0];
  const requestClose = host.onCloseRequested.mock.lastCall?.[0];
  if (!openPath || !requestClose) throw new Error('Workbench did not register host handlers');

  let closing!: Promise<boolean>;
  act(() => {
    openPath(project.path);
    closing = requestClose();
    openPath('web://queued');
  });
  expect(close).not.toHaveBeenCalled();

  await act(async () => {
    release();
    expect(await closing).toBe(true);
  });
  expect(opening).toHaveBeenCalledExactlyOnceWith({ path: project.path });
  expect(close).toHaveBeenCalledOnce();
  expect(runtime.engine.snapshot().sessionId).toBeFalsy();
});

async function mountWithComponent(name: string) {
  const runtime = createRuntime();
  const project = await seedProject(runtime, name);
  const { host } = fakeHost();
  const app = mount(runtime, host, (onHome) => uiFeatures(runtime.ids, onHome));
  const openPath = host.onOpenPath.mock.lastCall?.[0];
  if (!openPath) throw new Error('Workbench did not register an open-path handler');
  await act(async () => openPath(project.path));
  expect(await screen.findByText(project.name)).toBeTruthy();

  fireEvent.click(screen.getByRole('tab', { name: 'Plaadile paigutamata' }));
  fireEvent.click(screen.getByRole('button', { name: et.component.add }));
  const dialog = within(screen.getByRole('dialog', { name: et.component.addTitle }));
  fireEvent.click(dialog.getByRole('button', { name: et.component.add }));
  const component = runtime.engine.snapshot().doc.components[0];
  if (!component) throw new Error('Could not add a test component');
  const context = within(screen.getByRole('complementary', { name: et.shell.context }));
  expect(context.getByLabelText(et.component.ref)).toBeTruthy();
  expect(useSessionStore.getState().selection).toEqual({
    items: [{ kind: 'component', id: component.id }],
  });
  return { app, runtime, component, context };
}

test('undo clears a deleted component selection and redo leaves the context empty', async () => {
  const { app, runtime, component, context } = await mountWithComponent('Valiku tagasivõtmine');
  try {
    fireEvent.click(screen.getByRole('button', { name: et.shell.undo }));
    expect(runtime.engine.snapshot().doc.components).toHaveLength(0);
    expect.soft(useSessionStore.getState().selection).toEqual({ items: [] });
    expect.soft(context.queryByText(et.shell.contextEmpty)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: et.shell.redo }));
    expect(runtime.engine.snapshot().doc.components[0]?.id).toBe(component.id);
    expect.soft(useSessionStore.getState().selection).toEqual({ items: [] });
    expect.soft(context.queryByText(et.shell.contextEmpty)).toBeTruthy();
  } finally {
    app.unmount();
    await runtime.projects.close();
  }
});

test('removing the selected pin clears the selection while its component remains', async () => {
  const { app, runtime, component, context } = await mountWithComponent('Kadunud viik');
  try {
    const pin = component.pins[0];
    if (!pin) throw new Error('Test component has no pin');
    act(() =>
      useSessionStore.getState().setSelection({
        items: [{ kind: 'pin', componentId: component.id, id: pin.id }],
      }),
    );
    expect(context.getByLabelText(et.component.namePin(pin.id))).toBeTruthy();

    fireEvent.click(context.getByRole('button', { name: et.component.removePin(pin.id) }));
    const remaining = runtime.engine
      .snapshot()
      .doc.components.find(({ id }) => id === component.id);
    expect(remaining?.pins.map(({ id }) => id)).toEqual(
      component.pins.filter(({ id }) => id !== pin.id).map(({ id }) => id),
    );
    expect.soft(useSessionStore.getState().selection).toEqual({ items: [] });
    expect(context.getByText('Mõõtmiskoha jalg on kustutatud. Vali uus jalg.')).toBeTruthy();
    expect(context.queryByText(et.shell.contextEmpty)).toBeNull();
  } finally {
    app.unmount();
    await runtime.projects.close();
  }
});
