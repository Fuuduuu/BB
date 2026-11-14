// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { File as NodeFile, Blob as NodeBlob } from 'node:buffer';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { Workbench, useViewStore, et } from '@pcbk/ui';
import { addPhoto } from '@pcbk/features/photo/ui';
import { uiFeatures } from '@pcbk/features/ui';
import { createRuntime, type Runtime } from './runtime';
import { fakeHost } from './test-support/workbench';

const runtimes: Runtime[] = [];
beforeEach(() => {
  vi.stubGlobal('File', NodeFile);
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 1, height: 1, close() {} }),
  );
  URL.createObjectURL = vi.fn(() => 'blob:test-photo');
  URL.revokeObjectURL = vi.fn();
});
afterEach(async () => {
  cleanup();
  for (const runtime of runtimes.splice(0)) await runtime.projects.discard();
  useViewStore.getState().reset();
  vi.unstubAllGlobals();
});
function photo(name = '  Toiteplaat.rev2.PNG') {
  return new File(
    [
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4p8AAAAASUVORK5CYII=',
        'base64',
      ),
    ],
    name,
    { type: 'image/png' },
  );
}
function mount(add = true) {
  const runtime = createRuntime();
  runtimes.push(runtime);
  const { host } = fakeHost();
  const app = render(
    <EngineProvider engine={runtime.engine} projects={runtime.projects}>
      <Workbench
        host={host}
        uiModules={(onHome) => uiFeatures(runtime.ids, onHome)}
        {...(add && { addPhoto: (file: File) => addPhoto(file, runtime) })}
      />
    </EngineProvider>,
  );
  return { ...app, runtime };
}
const dropZone = () => screen.getByText('Lohista plaadi foto siia või kleebi Ctrl+V');
function drop(file: File, target: Element = dropZone()) {
  fireEvent.drop(target, { dataTransfer: { files: [file] } });
}

test('home_drop_creates_board_named_after_file_with_photo', async () => {
  const { runtime } = mount();
  drop(photo());
  await waitFor(() => expect(runtime.engine.snapshot().doc.photos).toHaveLength(1));
  expect(screen.getByRole('heading', { name: 'Toiteplaat.rev2' })).toBeTruthy();
  expect(runtime.engine.snapshot().doc.photos[0]?.name).toBe('  Toiteplaat.rev2.PNG');
  expect(useViewStore.getState().navigatorTab).toBe('library');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect((await runtime.projects.flush()).ok).toBe(true);
  const saved = (await runtime.repo.listProjects()).find(
    (project) => project.name === 'Toiteplaat.rev2',
  )!;
  expect((await runtime.projects.close()).ok).toBe(true);
  const reopened = await runtime.projects.open({ path: saved.path });
  expect(reopened.ok).toBe(true);
  expect(runtime.engine.snapshot().doc.photos).toHaveLength(1);
});

test('home_paste_creates_board_with_photo', async () => {
  const { runtime } = mount();
  fireEvent.paste(window, { clipboardData: { files: [photo('')] } });
  await waitFor(() => expect(runtime.engine.snapshot().doc.photos).toHaveLength(1));
  expect(runtime.engine.snapshot().doc.name).toMatch(/^Plaat \d{4}-\d{2}-\d{2}$/);
  expect(runtime.engine.snapshot().doc.photos[0]?.name).toBe('foto.png');
});

test('home_drop_without_image_creates_nothing', async () => {
  const { runtime } = mount();
  const before = await runtime.repo.listProjects();
  drop(new File(['text'], 'notes.txt', { type: 'text/plain' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Lohista siia JPEG- või PNG-foto.',
  );
  expect(runtime.engine.snapshot().sessionId).toBe('');
  expect(await runtime.repo.listProjects()).toEqual(before);
});

test('failed_import_keeps_new_board_open_with_reason', async () => {
  const { runtime, container } = mount();
  drop(new File(['heic'], 'Emaplaat.HEIC'));
  const bottom = await screen.findByRole('contentinfo', { name: 'Plaadi olek' });
  expect(await within(bottom).findByRole('alert')).toHaveProperty(
    'textContent',
    `Fotot ei saanud lisada: ${et.reason.unsupported_image}`,
  );
  expect(screen.getByRole('heading', { name: 'Emaplaat' })).toBeTruthy();
  expect(runtime.engine.snapshot().doc.photos).toHaveLength(0);
  expect(runtime.engine.snapshot().sessionId).not.toBe('');
  const sessionId = runtime.engine.snapshot().sessionId;
  drop(photo('Retry.png'), container.querySelector('svg[tabindex]')!);
  await waitFor(() => expect(runtime.engine.snapshot().doc.photos).toHaveLength(1));
  expect(runtime.engine.snapshot().sessionId).toBe(sessionId);
  expect(within(bottom).queryByRole('alert')).toBeNull();
  act(() => {
    expect(runtime.engine.undo().ok).toBe(true);
  });
  expect(runtime.engine.snapshot().doc.photos).toHaveLength(0);
  expect(within(bottom).queryByRole('alert')).toBeNull();
});

test.each(['arrayBuffer', 'importBytes'] as const)(
  'home_import_blocks_workspace_drop_during_slow_%s',
  async (stage) => {
    const { runtime, container } = mount();
    const first = photo('First.png');
    const second = photo('Second.png');
    const secondRead = vi.spyOn(second, 'arrayBuffer');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const importing = runtime.photos.importBytes.bind(runtime.photos);
    const importBytes = vi.spyOn(runtime.photos, 'importBytes');
    if (stage === 'arrayBuffer') {
      const read = first.arrayBuffer.bind(first);
      vi.spyOn(first, 'arrayBuffer').mockImplementationOnce(async () => {
        await gate;
        return read();
      });
    } else {
      importBytes.mockImplementationOnce(async (...args) => {
        await gate;
        return importing(...args);
      });
    }
    drop(first);
    await screen.findByRole('heading', { name: 'First' });
    if (stage === 'importBytes') await waitFor(() => expect(importBytes).toHaveBeenCalledOnce());
    const svg = container.querySelector('svg[tabindex]')!;
    expect(svg).toBeTruthy();
    await act(async () => {
      drop(second, svg);
    });
    try {
      expect(secondRead).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        release();
      });
    }
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Plaadil on juba foto. Foto vahetus tuleb hiljem.',
      ),
    );
    expect(secondRead).not.toHaveBeenCalled();
    expect(importBytes).toHaveBeenCalledOnce();
    expect(runtime.engine.snapshot().doc.photos.map(({ name }) => name)).toEqual(['First.png']);
    expect(screen.getByRole('heading', { name: 'First' })).toBeTruthy();
  },
);

test('theme_select_on_home_not_in_top_bar', async () => {
  mount();
  fireEvent.change(screen.getByRole('combobox', { name: 'Välimus' }), {
    target: { value: 'dark' },
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.click(screen.getByRole('button', { name: 'Uus plaat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Alusta' }));
  await screen.findByRole('contentinfo', { name: 'Plaadi olek' });
  expect(screen.queryByRole('combobox', { name: 'Välimus' })).toBeNull();
});

test('home_photo_import_disables_workspace_and_queues_second_drop', async () => {
  const { runtime } = mount();
  let decode!: (value: { width: number; height: number; close(): void }) => void;
  vi.mocked(createImageBitmap).mockReturnValueOnce(
    new Promise((resolve) => {
      decode = resolve;
    }),
  );
  const zone = dropZone();
  drop(photo('First.png'), zone);
  drop(photo('Second.png'), zone);
  await screen.findByRole('heading', { name: 'First' });
  expect(screen.getByRole('button', { name: 'Tagasi avalehele' }).matches(':disabled')).toBe(true);
  act(() => decode({ width: 1, height: 1, close() {} }));
  await screen.findByRole('heading', { name: 'Second' });
  await waitFor(() => expect(runtime.engine.snapshot().doc.photos).toHaveLength(1));
  expect(runtime.engine.snapshot().doc.photos[0]?.name).toBe('Second.png');
});

test('paste_ignores_dialog_inputs_and_is_removed_after_home', async () => {
  const { runtime } = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Uus plaat' }));
  fireEvent.paste(screen.getByLabelText('Nimi'), { clipboardData: { files: [photo()] } });
  expect(runtime.engine.snapshot().sessionId).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Katkesta' }));
  drop(photo());
  await waitFor(() => expect(runtime.engine.snapshot().doc.photos).toHaveLength(1));
  fireEvent.paste(window, { clipboardData: { files: [photo('Other.png')] } });
  expect(runtime.engine.snapshot().doc.name).toBe('Toiteplaat.rev2');
});

test('home_without_callback_hides_photo_entry_and_ignores_paste', async () => {
  const { runtime } = mount(false);
  expect(screen.queryByText('Lohista plaadi foto siia või kleebi Ctrl+V')).toBeNull();
  fireEvent.paste(window, { clipboardData: { files: [photo()] } });
  expect(runtime.engine.snapshot().sessionId).toBe('');
});
