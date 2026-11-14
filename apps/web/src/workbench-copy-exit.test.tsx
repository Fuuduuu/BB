// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { et } from '@pcbk/ui';
import { mountFailedSwitch } from './test-support/workbench';

function silenceExpectedCrash() {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const handler = (event: ErrorEvent) => {
    if (event.error?.message === 'Synthetic workbench failure') event.preventDefault();
  };
  window.addEventListener('error', handler);
  return () => window.removeEventListener('error', handler);
}

test.each(['host', 'reload'] as const)(
  'rescue copy waits for acknowledgement before %s and preserves close errors',
  async (intent) => {
    const restoreErrors = silenceExpectedCrash();
    let crash = false;
    const app = await mountFailedSwitch(undefined, () => [
      {
        id: 'recovery-test',
        title: 'Taastamise proov',
        contextPinned: [
          {
            id: 'crashing-slot',
            order: 0,
            useVisible() {
              if (crash) throw new Error('Synthetic workbench failure');
              return false;
            },
            render: () => null,
          },
        ],
      },
    ]);
    try {
      app.store.files.delete(app.current.path);
      if (intent === 'host') {
        const requestClose = app.host.onCloseRequested.mock.lastCall![0];
        await act(async () => expect(await requestClose()).toBe(false));
        fireEvent.click(
          within(screen.getByRole('dialog')).getByRole('button', {
            name: et.common.saveElsewhere,
          }),
        );
      } else {
        crash = true;
        act(() => {
          expect(app.engine.execute('project.rename', { name: 'Katkine vaade' }).ok).toBe(true);
        });
        fireEvent.click(await screen.findByRole('button', { name: et.error.copyReload }));
      }

      const notice = await screen.findByText(et.project.rescueCopy);
      expect(app.host.closeNow).not.toHaveBeenCalled();
      expect(app.host.reload).not.toHaveBeenCalled();
      expect(app.engine.snapshot().sessionId).toBeTruthy();
      expect(app.store.files.get('rescue.pcbk')!.doc).toMatchObject({
        problem: 'Salvestamata märkus',
      });
      if (intent === 'reload') {
        expect(screen.getByRole('heading', { name: et.error.root })).toBeTruthy();
      }
      const dismiss = within(notice.closest('[role="alert"]')!).getByRole<HTMLButtonElement>(
        'button',
        { name: et.common.close },
      );
      await waitFor(() => expect(dismiss.disabled).toBe(false));

      if (intent === 'reload') {
        // A second recovery copy would use the now-readable rescue as its source.
        app.pickSavePath.mockResolvedValue('second-rescue.pcbk');
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: et.error.copyReload }));
        });
        expect(app.host.reload).not.toHaveBeenCalled();
        expect(app.pickSavePath).toHaveBeenCalledOnce();
        expect(app.store.files.has('second-rescue.pcbk')).toBe(false);
      }

      // A queued native-close request must not bypass the acknowledgement either.
      const requestClose = app.host.onCloseRequested.mock.lastCall![0];
      await act(async () => expect(await requestClose()).toBe(false));
      act(() => {
        expect(app.engine.execute('project.setInfo', { problem: 'Viimane muudatus' }).ok).toBe(
          true,
        );
      });
      fireEvent.click(dismiss);
      const failure = await screen.findByRole('dialog', {
        name: et.save.closeTitle(et.reason.disk_full),
      });
      expect(app.host.closeNow).not.toHaveBeenCalled();
      expect(app.host.reload).not.toHaveBeenCalled();
      app.saving.mockRestore();
      fireEvent.click(within(failure).getByRole('button', { name: et.common.retry }));
      await waitFor(() =>
        expect(intent === 'host' ? app.host.closeNow : app.host.reload).toHaveBeenCalledOnce(),
      );
      expect(app.engine.snapshot().sessionId).toBeFalsy();
      expect(app.store.files.get('rescue.pcbk')!.doc).toMatchObject({
        problem: 'Viimane muudatus',
      });
    } finally {
      restoreErrors();
      await app.dispose();
    }
  },
);

test.each(['host', 'reload'] as const)(
  'normal copy continues %s without acknowledgement',
  async (intent) => {
    const restoreErrors = silenceExpectedCrash();
    let crash = false;
    const app = await mountFailedSwitch(undefined, () => [
      {
        id: 'recovery-test',
        title: 'Taastamise proov',
        contextPinned: [
          {
            id: 'crashing-slot',
            order: 0,
            useVisible() {
              if (crash) throw new Error('Synthetic workbench failure');
              return false;
            },
            render: () => null,
          },
        ],
      },
    ]);
    try {
      if (intent === 'host') {
        await act(async () =>
          expect(await app.host.onCloseRequested.mock.lastCall![0]()).toBe(false),
        );
        fireEvent.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: et.common.saveElsewhere }),
        );
      } else {
        crash = true;
        act(() => {
          expect(app.engine.execute('project.rename', { name: 'Katkine vaade' }).ok).toBe(true);
        });
        fireEvent.click(await screen.findByRole('button', { name: et.error.copyReload }));
      }
      await waitFor(() =>
        expect(intent === 'host' ? app.host.closeNow : app.host.reload).toHaveBeenCalledOnce(),
      );
      expect(screen.queryByText(et.project.rescueCopy)).toBeNull();
      expect(app.engine.snapshot().sessionId).toBeFalsy();
    } finally {
      restoreErrors();
      await app.dispose();
    }
  },
);

test('busy copy continuation keeps acknowledgement until the action settles', async () => {
  const app = await mountFailedSwitch();
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const open = app.repo.open.bind(app.repo);
  vi.spyOn(app.repo, 'open').mockImplementationOnce(async (path) => {
    await barrier;
    return open(path);
  });
  try {
    app.store.files.delete(app.current.path);
    await act(async () => app.openPath(app.target.path));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: et.common.saveElsewhere,
      }),
    );
    const notice = await screen.findByText(et.project.rescueCopy);
    const dismiss = within(notice.closest('[role="alert"]')!).getByRole<HTMLButtonElement>(
      'button',
      { name: et.common.close },
    );
    expect(dismiss.disabled).toBe(true);
    fireEvent.click(dismiss);
    expect(screen.getByText(et.project.rescueCopy)).toBeTruthy();
    await act(async () => release());
    await screen.findByRole('heading', { name: app.target.name });
    await waitFor(() => expect(dismiss.disabled).toBe(false));
    fireEvent.click(dismiss);
    expect(screen.queryByText(et.project.rescueCopy)).toBeNull();
    expect(app.host.closeNow).not.toHaveBeenCalled();
    expect(app.host.reload).not.toHaveBeenCalled();
  } finally {
    release();
    await app.dispose();
  }
});
