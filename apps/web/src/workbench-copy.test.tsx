// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
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
