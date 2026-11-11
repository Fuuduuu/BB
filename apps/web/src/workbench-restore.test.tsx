// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { AppHost, RecentProject } from '@pcbk/contracts';
import { et } from '@pcbk/ui';
import { createRuntime } from './runtime';
import type { Runtime } from './runtime';
import { fakeHost, mount, seedProject } from './test-support/workbench';

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
