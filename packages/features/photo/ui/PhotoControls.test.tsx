// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import type { ProjectService } from '@pcbk/contracts';
import type { BoardDoc } from '@pcbk/domain';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { photoUiFixture } from '../__tests__/ui-fixture';
import { createPhotoUi } from './index';

const open: ProjectService[] = [];
afterEach(async () => {
  cleanup();
  useViewStore.getState().reset();
  useSessionStore.getState().setToolId('select');
  for (const projects of open.splice(0)) await projects.discard();
});

async function fixture(withPhoto = true) {
  const { engine, host, projects } = photoUiFixture();
  open.push(projects);
  expect((await projects.create({ name: 'Foto' })).ok).toBe(true);
  if (withPhoto) {
    expect(
      engine.execute('photo.add', {
        photo: {
          id: 'pho_1',
          side: 'top',
          name: 'Plaat',
          widthPx: 300,
          heightPx: 200,
          transform: 'mirror',
        },
      }).ok,
    ).toBe(true);
  }
  render(
    <EngineProvider engine={engine} projects={projects}>
      {createPhotoUi().bottomBar?.[0]?.render()}
    </EngineProvider>,
  );
  return { engine, host };
}

test('photo_controls_change_view_without_document_revision', async () => {
  const { engine } = await fixture();
  const before = engine.snapshot();
  fireEvent.change(screen.getByRole('slider', { name: /Läbipaistvus/ }), {
    target: { value: '35' },
  });
  fireEvent.change(screen.getByRole('slider', { name: /Kontrast/ }), { target: { value: '140' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hall' }));
  fireEvent.click(screen.getByRole('button', { name: 'Peida foto' }));
  expect(useViewStore.getState().modules.photo).toEqual({
    visible: false,
    opacity: 0.35,
    contrast: 1.4,
    gray: true,
  });
  expect(screen.getByRole('button', { name: 'Näita fotot' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(screen.getByRole('button', { name: 'Hall' }).getAttribute('aria-pressed')).toBe('true');
  expect(engine.snapshot()).toBe(before);
});

test('rotate_and_mirror_are_single_undoable_steps', async () => {
  const { engine } = await fixture();
  const before = engine.snapshot();
  fireEvent.click(screen.getByRole('button', { name: 'Pööra 90°' }));
  expect(engine.snapshot().rev).toBe(before.rev + 1);
  expect(engine.snapshot().doc).toEqual({
    ...before.doc,
    rev: before.rev + 1,
    photos: [{ ...before.doc.photos[0], transform: 'mirror_rot90' }],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Peegelda' }));
  expect(engine.snapshot().rev).toBe(before.rev + 2);
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('rot270');
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('mirror_rot90');
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(engine.snapshot().doc).toEqual({ ...before.doc, rev: before.rev + 4 });
  act(() => {
    expect(engine.redo().ok).toBe(true);
  });
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('mirror_rot90');
});

test('scale_chip_shows_uncalibrated_or_px_per_mm', async () => {
  const { engine } = await fixture(false);
  const chip = screen.getByText('Kalibreerimata');
  expect(chip.closest('button')?.getAttribute('aria-label')).toBe('Kalibreeri mõõtkava (K)');
  expect(screen.queryByRole('button', { name: 'Pööra 90°' })).toBeNull();
  expect(screen.queryByRole('slider')).toBeNull();
  act(() => {
    expect(
      engine.execute('photo.setScale', {
        a: { x: 0, y: 0 },
        b: { x: 281, y: 0 },
        mm: 20,
      }).ok,
    ).toBe(true);
  });
  expect(screen.getByRole('button', { name: 'Kalibreeri mõõtkava (K)' }).textContent).toBe(
    '14,05 px/mm',
  );
});

test('scale_chip_starts_calibration_tool', async () => {
  const { engine } = await fixture(false);
  const before = engine.snapshot();
  fireEvent.click(screen.getByRole('button', { name: 'Kalibreeri mõõtkava (K)' }));
  expect(useSessionStore.getState().toolId).toBe('photo.calibrate');
  expect(engine.snapshot()).toBe(before);
});

test('read_only_photo_blocks_transform_but_allows_view_controls', async () => {
  const { engine, host } = await fixture();
  const before = engine.snapshot();
  act(() => host.load(before.sessionId, structuredClone(before.doc) as BoardDoc, true));
  const readOnly = engine.snapshot();
  fireEvent.click(screen.getByRole('button', { name: 'Pööra 90°' }));
  expect(engine.snapshot()).toBe(readOnly);
  expect(screen.getByRole('alert').textContent).toBe('Projekt on kirjutuskaitstud.');
  fireEvent.click(screen.getByRole('button', { name: 'Peegelda' }));
  expect(engine.snapshot()).toBe(readOnly);
  fireEvent.click(screen.getByRole('button', { name: 'Hall' }));
  expect(useViewStore.getState().modules.photo).toMatchObject({ gray: true });
  expect(engine.snapshot()).toBe(readOnly);
});
