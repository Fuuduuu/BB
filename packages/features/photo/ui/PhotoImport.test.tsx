// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider, useSnapshot } from '@pcbk/client';
import type { ProjectService } from '@pcbk/contracts';
import { photoUiFixture } from '../__tests__/ui-fixture';
import { createPhotoUi } from './index';

const opened: ProjectService[] = [];
afterEach(async () => {
  cleanup();
  createPhotoUi().onSessionReset?.();
  for (const projects of opened.splice(0)) await projects.discard();
  vi.restoreAllMocks();
});

async function fixture(withPhoto = false) {
  const context = photoUiFixture();
  opened.push(context.projects);
  await context.projects.create({ name: 'Plaat' });
  const module = createPhotoUi();
  module.onSessionReset?.();
  if (withPhoto)
    context.engine.execute('photo.add', {
      photo: {
        id: 'pho_original',
        name: 'Algne',
        side: 'top',
        widthPx: 500,
        heightPx: 300,
        transform: 'none',
      },
    });
  const click = vi.fn();
  function Workspace() {
    const snapshot = useSnapshot((snapshot) => snapshot);
    return (
      <>
        <svg onClick={click}>
          {module.canvasLayers?.map((layer) => (
            <g key={layer.id}>{layer.render({ snapshot, preview: null, zoom: 1 })}</g>
          ))}
        </svg>
        {module.bottomBar?.map((slot) => (
          <div key={slot.id}>{slot.render()}</div>
        ))}
      </>
    );
  }
  const view = render(
    <EngineProvider engine={context.engine} projects={context.projects}>
      <Workspace />
    </EngineProvider>,
  );
  const file = new File(['photo'], 'Plaat.PNG', { type: 'image/png' });
  const bytes = new Uint8Array([4, 5, 6]).buffer;
  const read = vi.fn(async () => bytes);
  Object.defineProperty(file, 'arrayBuffer', { value: read });
  return {
    ...context,
    ...view,
    module,
    file,
    bytes,
    read,
    click,
    svg: view.container.querySelector('svg')!,
  };
}

test('add_photo_button_only_without_photo', async () => {
  const context = await fixture();
  const button = screen.getByRole('button', { name: 'Lisa foto' });
  const input = context.container.querySelector<HTMLInputElement>('input[type=file]')!;
  expect(input.accept).toBe('image/jpeg,image/png');
  const choose = vi.spyOn(input, 'click');
  fireEvent.click(button);
  expect(choose).toHaveBeenCalledOnce();
  fireEvent.change(input, { target: { files: [context.file] } });
  await waitFor(() => expect(context.engine.snapshot().doc.photos).toHaveLength(1));
  expect(context.importBytes.mock.calls[0]?.slice(1)).toEqual([
    context.bytes,
    expect.stringMatching(/^pho_/),
    'Plaat.PNG',
  ]);
  expect(screen.queryByRole('button', { name: 'Lisa foto' })).toBeNull();
});

test('canvas_drop_with_photo_shows_limit_and_imports_nothing', async () => {
  const context = await fixture(true);
  const before = context.engine.snapshot();
  fireEvent.drop(context.svg, { dataTransfer: { files: [context.file] } });
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      'Plaadil on juba foto. Foto vahetus tuleb hiljem.',
    ),
  );
  expect(context.engine.snapshot()).toBe(before);
  expect(context.importBytes).not.toHaveBeenCalled();
  expect(context.read).not.toHaveBeenCalled();
});

test('canvas_import_queue_waits_then_rechecks_photo_limit', async () => {
  const context = await fixture();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  context.read.mockImplementationOnce(async () => {
    await pending;
    return context.bytes;
  });
  fireEvent.drop(context.svg, { dataTransfer: { files: [context.file] } });
  fireEvent.drop(context.svg, { dataTransfer: { files: [context.file] } });
  await waitFor(() => expect(context.read).toHaveBeenCalledOnce());
  expect((screen.getByRole('button', { name: 'Lisa foto' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(context.importBytes).not.toHaveBeenCalled();
  await act(async () => {
    release();
  });
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Plaadil on juba foto.'),
  );
  expect(context.importBytes).toHaveBeenCalledOnce();
  expect(context.read).toHaveBeenCalledOnce();
  expect(context.engine.snapshot().doc.photos).toHaveLength(1);
});

test('canvas_import_failure_is_localized_and_can_retry', async () => {
  const context = await fixture();
  context.read.mockRejectedValueOnce(new Error('broken file'));
  fireEvent.drop(context.svg, { dataTransfer: { files: [context.file] } });
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      'Fotot ei saanud lisada: Pildifail on vigane või poolik.',
    ),
  );
  expect((screen.getByRole('button', { name: 'Lisa foto' }) as HTMLButtonElement).disabled).toBe(
    false,
  );
  fireEvent.drop(context.svg, { dataTransfer: { files: [context.file] } });
  await waitFor(() => expect(context.engine.snapshot().doc.photos).toHaveLength(1));
  expect(screen.queryByRole('alert')).toBeNull();
});

test('canvas_drop_uses_shared_file_selection_and_keeps_tools_clickable', async () => {
  const context = await fixture();
  fireEvent.click(context.svg);
  expect(context.click).toHaveBeenCalledOnce();
  fireEvent.drop(context.svg, {
    dataTransfer: { files: [new File(['text'], 'notes.txt'), context.file] },
  });
  await waitFor(() => expect(context.engine.snapshot().doc.photos).toHaveLength(1));
  expect(context.engine.snapshot().doc.photos[0]?.name).toBe('Plaat.PNG');
  expect(
    context.container.querySelector('[data-layer="photo.drop"]')?.getAttribute('pointer-events'),
  ).toBe('none');
});

test('canvas_drag_listeners_are_removed_on_unmount', async () => {
  const context = await fixture();
  expect(fireEvent.dragEnter(context.svg, { dataTransfer: { types: ['Files'] } })).toBe(false);
  expect(fireEvent.dragOver(context.svg, { dataTransfer: { types: ['Files'] } })).toBe(false);
  context.unmount();
  fireEvent.drop(context.svg, { dataTransfer: { files: [context.file] } });
  await Promise.resolve();
  expect(context.read).not.toHaveBeenCalled();
  expect(context.importBytes).not.toHaveBeenCalled();
});

test('session_reset_drops_feedback_and_pending_import', async () => {
  const context = await fixture();
  let release!: () => void;
  context.read.mockImplementationOnce(
    () =>
      new Promise<ArrayBuffer>((resolve) => {
        release = () => resolve(context.bytes);
      }),
  );
  fireEvent.drop(context.svg, { dataTransfer: { files: [context.file] } });
  await waitFor(() => expect(context.read).toHaveBeenCalledOnce());
  await act(async () => {
    await context.projects.discard();
    await context.projects.create({ name: 'Teine' });
    context.module.onSessionReset?.();
    release();
  });
  expect(context.engine.snapshot().doc.photos).toEqual([]);
  expect(context.importBytes).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
  expect((screen.getByRole('button', { name: 'Lisa foto' }) as HTMLButtonElement).disabled).toBe(
    false,
  );
});
