// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Blob } from 'node:buffer';
import { URL } from 'node:url';
import { uiFeatures } from '@pcbk/features/ui';
import { useViewStore } from '@pcbk/ui';
import { createRuntime } from './runtime';
import { fakeHost, mount, openWorkbenchProject } from './test-support/workbench';

afterEach(() => vi.unstubAllGlobals());

test('photo_view_settings_survive_reopen_without_rev', async () => {
  // Supply browser image APIs while keeping the photo repository and IndexedDB real.
  vi.stubGlobal('Blob', Blob);
  vi.stubGlobal('URL', URL);
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close() {} }));
  let runtime = createRuntime();
  const created = await runtime.projects.create({ name: 'Foto vaate proov' });
  if (!created.ok) throw new Error('Expected a created project');
  const { path } = created.value;
  const importing = await runtime.repo.open(path);
  const photo = await runtime.photos.importBytes(
    importing.session,
    Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4p8AAAAASUVORK5CYII=',
        'base64',
      ),
    ).buffer,
    'pho_view_test',
    'Sünteetiline foto',
  );
  await runtime.repo.close(importing.session);
  expect(
    runtime.engine.execute('photo.add', {
      photo,
    }).ok,
  ).toBe(true);
  expect((await runtime.projects.close()).ok).toBe(true);

  let { host } = fakeHost();
  let app = mount(runtime, host, (onHome) => uiFeatures(runtime.ids, onHome));
  try {
    await openWorkbenchProject(runtime, host, path);
    const before = runtime.engine.snapshot();
    fireEvent.change(screen.getByRole('slider', { name: 'Läbipaistvus' }), {
      target: { value: '35' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Kontrast' }), {
      target: { value: '140' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hall' }));
    fireEvent.click(screen.getByRole('button', { name: 'Peida foto' }));
    const settings = { visible: false, opacity: 0.35, contrast: 1.4, gray: true };
    expect(useViewStore.getState().modules.photo).toEqual(settings);
    await act(async () => expect((await runtime.projects.flush()).ok).toBe(true));
    expect(runtime.engine.snapshot()).toMatchObject({ rev: before.rev, history: before.history });
    app.unmount();
    expect((await runtime.projects.close()).ok).toBe(true);
    act(() => useViewStore.getState().reset());

    runtime = createRuntime();
    ({ host } = fakeHost());
    app = mount(runtime, host, (onHome) => uiFeatures(runtime.ids, onHome));
    await openWorkbenchProject(runtime, host, path);
    expect(useViewStore.getState().modules.photo).toEqual(settings);
    expect(screen.getByRole<HTMLInputElement>('slider', { name: 'Läbipaistvus' }).value).toBe('35');
    expect(screen.getByRole<HTMLInputElement>('slider', { name: 'Kontrast' }).value).toBe('140');
    expect(screen.getByRole('button', { name: 'Hall' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Näita fotot' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(runtime.engine.snapshot().rev).toBe(before.rev);
    expect(runtime.engine.snapshot().doc).toEqual(before.doc);
  } finally {
    app.unmount();
    await runtime.projects.discard();
  }
});
