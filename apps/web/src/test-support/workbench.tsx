import { componentEt } from '../../../../packages/features/components/ui/i18n/et';
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { createMemoryRepository, createMemoryStore } from '@pcbk/adapters';
import { newId } from '@pcbk/domain';
import { createEngine, createProjectService, StorageError } from '@pcbk/engine';
import { engineFeatures, RESERVED_FIELDS } from '@pcbk/features/engine';
import type { AppHost, RecentProject } from '@pcbk/contracts';
import { uiFeatures } from '@pcbk/features/ui';
import { et, useSessionStore, useViewStore, Workbench } from '@pcbk/ui';
import type { ComponentProps } from 'react';
import { createRuntime } from '../runtime';
import type { Runtime } from '../runtime';

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

export function fakeHost(recents: RecentProject[] = []) {
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

export function mount(
  runtime: Pick<Runtime, 'engine' | 'projects'>,
  host: AppHost,
  uiModules: ComponentProps<typeof Workbench>['uiModules'] = () => [],
) {
  return render(
    <EngineProvider engine={runtime.engine} projects={runtime.projects}>
      <Workbench host={host} uiModules={uiModules} />
    </EngineProvider>,
  );
}

export async function seedProject(runtime: Pick<Runtime, 'projects'>, name: string) {
  const created = await runtime.projects.create({ name });
  if (!created.ok) throw new Error(`Could not create a test project: ${created.error.code}`);
  expect((await runtime.projects.close()).ok).toBe(true);
  return created.value;
}

export async function openWorkbenchProject(
  runtime: Pick<Runtime, 'projects'>,
  host: ReturnType<typeof fakeHost>['host'],
  path: string,
) {
  const openPath = host.onOpenPath.mock.lastCall?.[0];
  if (!openPath) throw new Error('Workbench did not register an open-path handler');
  const opening = vi.spyOn(runtime.projects, 'open');
  try {
    await act(async () => {
      // The host callback returns void; keep the real asynchronous open inside act.
      openPath(path);
      expect(opening).toHaveBeenCalledExactlyOnceWith({ path });
      await opening.mock.results[0]!.value;
    });
  } finally {
    opening.mockRestore();
  }
}

export async function mountWithComponent(name: string) {
  const runtime = createRuntime();
  const project = await seedProject(runtime, name);
  const { host } = fakeHost();
  const app = mount(runtime, host, (onHome) => uiFeatures(runtime.ids, onHome));
  await openWorkbenchProject(runtime, host, project.path);
  expect(await screen.findByText(project.name)).toBeTruthy();

  fireEvent.click(screen.getByRole('tab', { name: 'Plaadile paigutamata' }));
  fireEvent.click(screen.getByRole('button', { name: componentEt.add }));
  const dialog = within(screen.getByRole('dialog', { name: componentEt.addTitle }));
  fireEvent.click(dialog.getByRole('button', { name: componentEt.add }));
  const component = runtime.engine.snapshot().doc.components[0];
  if (!component) throw new Error('Could not add a test component');
  const context = within(screen.getByRole('complementary', { name: et.shell.context }));
  expect(context.getByLabelText(componentEt.ref)).toBeTruthy();
  expect(useSessionStore.getState().selection).toEqual({
    items: [{ kind: 'component', id: component.id }],
  });
  return { app, runtime, component, context };
}

export async function mountFailedSwitch(
  error = new StorageError('disk_full'),
  uiModules?: ComponentProps<typeof Workbench>['uiModules'],
) {
  const clock = { now: () => new Date().toISOString() };
  const ids = { newId };
  const { engine, host: engineHost } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock,
  });
  const store = createMemoryStore();
  const repo = createMemoryRepository(store);
  const projects = createProjectService({
    engine,
    host: engineHost,
    repo,
    clock,
    ids,
    photos: {
      prune: async () => undefined,
      url: () => '',
      importBytes: async () => {
        throw new StorageError('unknown');
      },
    },
  });
  const runtime = { engine, projects };
  const current = await seedProject(runtime, 'Praegune plaat');
  const target = await seedProject(runtime, 'Teine plaat');
  const { host } = fakeHost();
  const pickSavePath = vi.fn().mockResolvedValue('rescue.pcbk');
  const app = mount(
    runtime,
    { ...host, kind: 'desktop', pickSavePath },
    uiModules ?? ((onHome) => uiFeatures(ids, onHome)),
  );
  const openPath = host.onOpenPath.mock.lastCall![0];
  await act(async () => openPath(current.path));
  await screen.findByRole('heading', { name: current.name });
  act(() => {
    expect(engine.execute('project.setInfo', { problem: 'Salvestamata märkus' }).ok).toBe(true);
  });
  const saving = vi.spyOn(repo, 'save').mockRejectedValue(error);
  const opening = vi.spyOn(projects, 'open');
  const flushing = vi.spyOn(projects, 'flush');
  return {
    ...runtime,
    repo,
    store,
    host,
    target,
    current,
    pickSavePath,
    saving,
    opening,
    flushing,
    openPath,
    async dispose() {
      app.unmount();
      await projects.discard();
    },
  };
}
