// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { et } from '@pcbk/ui';
import { mountFailedSwitch } from './test-support/workbench';

const rescueCopy =
  'Koopia tehti mälus olevast seisust, sest algset faili ei saanud lugeda. Fotod ja manused jäid algsesse faili.';

test('rescue_copy_shows_photos_left_in_original', async () => {
  const app = await mountFailedSwitch();
  try {
    // A missing source forces the real memory repository to copy the live document.
    app.store.files.delete(app.current.path);
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: et.common.saveElsewhere }));

    await screen.findByRole('heading', { name: app.target.name });
    expect(app.store.files.get('rescue.pcbk')!.doc).toMatchObject({
      problem: 'Salvestamata märkus',
    });
    const notice = screen.getByRole('alert');
    expect(within(notice).getByText(rescueCopy)).toBeTruthy();

    // The next project can be used without silently losing the rescue warning.
    act(() => {
      expect(app.engine.execute('project.setInfo', { problem: 'Järgmise plaadi märkus' }).ok).toBe(
        true,
      );
    });
    expect(screen.getByText(rescueCopy)).toBeTruthy();
    fireEvent.click(within(notice).getByRole('button', { name: et.common.close }));
    expect(screen.queryByText(rescueCopy)).toBeNull();
    expect(screen.getByRole('heading', { name: app.target.name })).toBeTruthy();
  } finally {
    await app.dispose();
  }
});

test('normal_copy_shows_no_rescue_notice', async () => {
  const app = await mountFailedSwitch();
  try {
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: et.common.saveElsewhere }));

    await screen.findByRole('heading', { name: app.target.name });
    expect(app.store.files.get('rescue.pcbk')!.doc).toMatchObject({
      problem: 'Salvestamata märkus',
    });
    expect(app.store.files.has(app.current.path)).toBe(true);
    expect(screen.queryByText(rescueCopy)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  } finally {
    await app.dispose();
  }
});

test('close_dialog_shows_copy_error_inside_dialog', async () => {
  const app = await mountFailedSwitch();
  vi.spyOn(app.projects, 'copy').mockResolvedValueOnce({
    ok: false,
    error: { code: 'storage', reason: 'read_only' },
  });
  try {
    await act(async () => app.openPath(app.target.path));
    const dialog = await screen.findByRole('dialog', {
      name: et.save.closeTitle(et.reason.disk_full),
    });
    fireEvent.click(within(dialog).getByRole('button', { name: et.common.saveElsewhere }));
    const error = await within(dialog).findByRole('alert');
    expect(error.textContent).toBe(`Koopia salvestamine ebaõnnestus: ${et.reason.read_only}`);
    expect(screen.getAllByText(error.textContent!)).toEqual([error]);
    expect(screen.queryByText(et.reason.read_only)).toBeNull();
    expect(screen.getByRole('dialog', { name: et.save.closeTitle(et.reason.disk_full) })).toBe(
      dialog,
    );
  } finally {
    await app.dispose();
  }
});

test('picker_copy_sends_create_or_confirmed_replace', async () => {
  for (const replace of [false, true]) {
    const app = await mountFailedSwitch();
    try {
      const dest = replace ? app.target.path : 'new-copy.pcbk';
      const replaceToken = app.repo.replaceToken(dest);
      expect(replaceToken).toEqual(replace ? expect.any(String) : null);
      app.pickSavePath.mockResolvedValueOnce({ path: dest, replaceToken });
      const copying = vi.spyOn(app.projects, 'copy');

      await act(async () => expect((await app.projects.flush()).ok).toBe(false));
      const saveElsewhere = await screen.findByRole('button', { name: et.common.saveElsewhere });
      await act(async () => fireEvent.click(saveElsewhere));

      const expected = replace
        ? { dest, identity: 'same', replaceToken }
        : { dest, identity: 'same' };
      expect(copying).toHaveBeenCalledExactlyOnceWith(expected);
      expect(await copying.mock.results[0]!.value).toMatchObject({ ok: true });
      expect(app.store.files.get(dest)?.projectId).toBe(app.current.projectId);
    } finally {
      await app.dispose();
    }
  }
});

test('picker_copy_reports_taken_path_without_replacing', async () => {
  const app = await mountFailedSwitch();
  const dest = 'late-copy.pcbk';
  const lateFile = structuredClone(app.store.files.get(app.target.path)!);
  app.pickSavePath.mockResolvedValueOnce({ path: dest, replaceToken: null });
  const copy = app.projects.copy.bind(app.projects);
  vi.spyOn(app.projects, 'copy').mockImplementationOnce((req) => {
    app.store.files.set(dest, lateFile);
    return copy(req);
  });
  const closing = vi.spyOn(app.projects, 'close');
  try {
    await act(async () => expect((await app.projects.flush()).ok).toBe(false));
    const before = app.engine.snapshot();
    const saveElsewhere = await screen.findByRole('button', { name: et.common.saveElsewhere });
    await act(async () => fireEvent.click(saveElsewhere));

    expect(app.store.files.get(dest)).toEqual(lateFile);
    expect(screen.getByText(et.reason.exists)).toBeTruthy();
    expect(screen.getByRole('heading', { name: app.current.name })).toBeTruthy();
    expect(app.engine.snapshot()).toBe(before);
    expect(closing).not.toHaveBeenCalled();
    expect(app.host.closeNow).not.toHaveBeenCalled();
    expect(app.host.reload).not.toHaveBeenCalled();
  } finally {
    await app.dispose();
  }
});
