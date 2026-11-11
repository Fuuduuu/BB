// @vitest-environment jsdom
import { componentEt } from '../../../packages/features/components/ui/i18n/et';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { et, useSessionStore } from '@pcbk/ui';
import { createRuntime } from './runtime';
import { StorageError } from '@pcbk/engine';
import {
  fakeHost,
  mount,
  mountFailedSwitch,
  mountWithComponent,
  seedProject,
} from './test-support/workbench';

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
    expect(context.getByLabelText(componentEt.namePin(pin.id))).toBeTruthy();

    fireEvent.click(context.getByRole('button', { name: componentEt.removePin(pin.id) }));
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

test('open_other_project_after_save_error_shows_close_dialog', async () => {
  const app = await mountFailedSwitch();
  try {
    const before = app.engine.snapshot();
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog', {
      name: et.save.closeTitle(et.reason.disk_full),
    });
    expect(within(dialog).getByRole('button', { name: 'Ava salvestamata' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: et.common.cancel })).toBeTruthy();
    expect(app.flushing).toHaveBeenCalledOnce();
    expect(app.opening).not.toHaveBeenCalled();
    expect(app.engine.snapshot()).toBe(before);
  } finally {
    await app.dispose();
  }
});

test('open_retry_success_opens_target', async () => {
  const app = await mountFailedSwitch();
  try {
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog');
    app.saving.mockRestore();
    fireEvent.click(within(dialog).getByRole('button', { name: et.common.retry }));
    await screen.findByRole('heading', { name: app.target.name });
    expect(app.opening).toHaveBeenCalledExactlyOnceWith({ path: app.target.path });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(app.store.files.get(app.current.path)!.doc).toMatchObject({
      problem: 'Salvestamata märkus',
    });
    expect(app.host.closeNow).not.toHaveBeenCalled();
    expect(app.host.reload).not.toHaveBeenCalled();
  } finally {
    await app.dispose();
  }
});

test('open_discard_opens_target_without_leaving_workbench', async () => {
  const app = await mountFailedSwitch();
  try {
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog');
    const discard = vi.spyOn(app.projects, 'discard');
    const savedCalls = app.saving.mock.calls.length;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ava salvestamata' }));
    await screen.findByRole('heading', { name: app.target.name });
    expect(discard).toHaveBeenCalledOnce();
    expect(app.saving).toHaveBeenCalledTimes(savedCalls);
    expect(app.store.files.get(app.current.path)!.doc).not.toHaveProperty('problem');
    expect(app.host.closeNow).not.toHaveBeenCalled();
    expect(app.host.reload).not.toHaveBeenCalled();
  } finally {
    await app.dispose();
  }
});

test('open_cancel_keeps_current_project', async () => {
  const app = await mountFailedSwitch();
  try {
    const before = app.engine.snapshot();
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: et.common.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(app.engine.snapshot()).toBe(before);
    expect(app.opening).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: app.current.name })).toBeTruthy();
  } finally {
    await app.dispose();
  }
});

test('open_save_elsewhere_preserves_changes_then_opens_target', async () => {
  const app = await mountFailedSwitch();
  try {
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: et.common.saveElsewhere }));
    await screen.findByRole('heading', { name: app.target.name });
    expect(app.pickSavePath).toHaveBeenCalledExactlyOnceWith(app.current.name);
    expect(app.store.files.get('rescue.pcbk')!.doc).toMatchObject({
      problem: 'Salvestamata märkus',
    });
    expect(app.store.files.get(app.current.path)!.doc).not.toHaveProperty('problem');
    expect(app.host.closeNow).not.toHaveBeenCalled();
  } finally {
    await app.dispose();
  }
});

test('open_stale_revision_keeps_close_reason', async () => {
  const app = await mountFailedSwitch(new StorageError('unknown', 7));
  try {
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog', {
      name: et.save.closeTitle(et.reason.stale_rev),
    });
    expect(within(dialog).queryByRole('button', { name: et.common.retry })).toBeNull();
    expect(app.opening).not.toHaveBeenCalled();
  } finally {
    await app.dispose();
  }
});
