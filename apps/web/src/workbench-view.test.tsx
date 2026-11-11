// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { AppHost, RecentProject } from '@pcbk/contracts';
import { et, useViewStore } from '@pcbk/ui';
import { createRuntime } from './runtime';
import { fakeHost, mount, seedProject } from './test-support/workbench';

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
