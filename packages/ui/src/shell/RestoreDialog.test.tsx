// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BackupInfo, ProjectService } from '@pcbk/contracts';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RestoreDialog } from './RestoreDialog';

const project = {
  path: 'C:/boards/old.pcbk',
  projectId: 'old-board',
  name: 'Vana plaat',
  updatedAt: '2026-11-07T14:30:00Z',
};
const older: BackupInfo = {
  file: 'old.full.pcbk',
  at: '2026-11-07T14:45:15+02:00',
  kind: 'full',
};
const newer: BackupInfo = {
  file: 'new.doc.pcbk',
  at: '2026-11-07T13:15:45Z',
  kind: 'doc',
  base: older.file,
};

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

afterEach(() => {
  cleanup();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

test('restore dialog selects the newest backup by default and confirms the selected row', async () => {
  const loadBackups = vi.fn<ProjectService['backups']>().mockResolvedValue({
    ok: true,
    value: [older, newer],
  });
  const onRestore = vi.fn().mockResolvedValue(true);
  render(
    <RestoreDialog
      project={project}
      loadBackups={loadBackups}
      onRestore={onRestore}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByText('Varukoopiaid laaditakse…')).toBeTruthy();
  const choices = (await screen.findAllByRole('radio')) as HTMLInputElement[];
  expect(loadBackups).toHaveBeenCalledExactlyOnceWith({ projectId: project.projectId });
  expect(choices).toEqual([
    screen.getByRole('radio', { name: /Muudatuste koopia/ }),
    screen.getByRole('radio', { name: /Täiskoopia/ }),
  ]);
  expect(choices[0]?.checked).toBe(true);
  const displayedTime = screen.getByText(/\d{2}:\d{2}$/, {
    selector: `time[datetime="${newer.at}"]`,
  });
  expect(displayedTime.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  fireEvent.click(choices[1]!);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Taasta' }));
  });
  expect(onRestore).toHaveBeenCalledExactlyOnceWith(older.file);
});

test('restore dialog retries a failed listing and leaves confirmation disabled for an empty list', async () => {
  const loadBackups = vi
    .fn<ProjectService['backups']>()
    .mockResolvedValueOnce({ ok: false, error: { code: 'stale_session' } })
    .mockResolvedValueOnce({ ok: true, value: [] });
  render(
    <RestoreDialog
      project={project}
      loadBackups={loadBackups}
      onRestore={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  const confirm = screen.getByRole('button', { name: 'Taasta' }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Taastamine ebaõnnestus. Algne projekt on muutmata.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Proovi uuesti' }));
  expect(await screen.findByText('Selle projekti varukoopiaid ei leitud.')).toBeTruthy();
  expect(confirm.disabled).toBe(true);
  expect(loadBackups).toHaveBeenCalledTimes(2);
});

test('restore in progress cannot be canceled or submitted again and a failed restore can retry', async () => {
  const loadBackups = vi.fn<ProjectService['backups']>().mockResolvedValue({
    ok: true,
    value: [newer],
  });
  let finish!: (success: boolean) => void;
  const onRestore = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const onClose = vi.fn();
  render(
    <RestoreDialog
      project={project}
      loadBackups={loadBackups}
      onRestore={onRestore}
      onClose={onClose}
    />,
  );
  await screen.findByRole('radio');
  const confirm = screen.getByRole('button', { name: 'Taasta' }) as HTMLButtonElement;
  fireEvent.click(confirm);
  expect(confirm.disabled).toBe(true);
  fireEvent.click(confirm);
  fireEvent.click(screen.getByRole('button', { name: 'Katkesta' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(onRestore).toHaveBeenCalledExactlyOnceWith(newer.file);
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => finish(false));
  expect(screen.getByRole('alert').textContent).toBe(
    'Taastamine ebaõnnestus. Algne projekt on muutmata.',
  );
  expect(confirm.disabled).toBe(false);
});
