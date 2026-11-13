// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useSessionStore } from '@pcbk/ui';
import { calibrationWorkspace } from '../__tests__/calibration-workspace';
import { useCalibrateStore } from './calibrate-store';

function confirm(mm: string) {
  const dialog = within(screen.getByRole('dialog', { name: 'Kalibreeri mõõtkava' }));
  fireEvent.change(dialog.getByRole('textbox', { name: 'Vahe millimeetrites' }), {
    target: { value: mm },
  });
  fireEvent.click(dialog.getByRole('button', { name: 'Kalibreeri' }));
}

test('calibration_two_clicks_open_mm_dialog', async () => {
  const { click, start, execute } = await calibrationWorkspace({ withPhoto: false });
  start();
  expect(useSessionStore.getState().toolId).toBe('photo.calibrate');
  click(57, 79);
  expect(screen.queryByRole('dialog', { name: 'Kalibreeri mõõtkava' })).toBeNull();
  click(257, 79);
  const dialog = screen.getByRole('dialog', { name: 'Kalibreeri mõõtkava' });
  expect(within(dialog).getByText('Punktide vahe: 100,0 px')).toBeTruthy();
  expect(within(dialog).getByRole('textbox', { name: 'Vahe millimeetrites' })).toBe(
    document.activeElement,
  );
  expect(execute).not.toHaveBeenCalled();
});

test('escape_before_second_click_cancels_without_command', async () => {
  const { engine, execute, click, start } = await calibrationWorkspace({ withPhoto: false });
  const before = engine.snapshot();
  start();
  click(57, 79);
  expect(useCalibrateStore.getState().a).toEqual({ x: 10, y: 20 });
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(useCalibrateStore.getState()).toMatchObject({
    a: null,
    b: null,
    cursor: null,
    dialogOpen: false,
    error: null,
  });
  expect(engine.snapshot()).toBe(before);
  expect(execute).not.toHaveBeenCalled();
});

test('calibration_sets_px_per_mm_in_one_undoable_step', async () => {
  const { engine, execute, click, start, undo } = await calibrationWorkspace();
  const before = engine.snapshot();
  start();
  click(57, 79);
  click(257, 79);
  confirm('5');
  expect(execute).toHaveBeenCalledExactlyOnceWith('photo.setScale', {
    a: { x: 10, y: 20 },
    b: { x: 110, y: 20 },
    mm: 5,
  });
  expect(engine.snapshot().rev).toBe(before.rev + 1);
  expect(engine.snapshot().doc.scale).toEqual({
    calibrated: true,
    pxPerMm: 20,
    calib: { a: { x: 10, y: 20 }, b: { x: 110, y: 20 }, mm: 5 },
  });
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(screen.queryByRole('dialog', { name: 'Kalibreeri mõõtkava' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Kalibreeri mõõtkava (K)' }).textContent).toBe(
    '20,00 px/mm',
  );
  undo();
  expect(engine.snapshot().doc).toEqual({ ...before.doc, rev: before.rev + 2 });
});

test('calibration_keeps_component_centers', async () => {
  const { engine, click, start } = await calibrationWorkspace({ withComponent: true });
  const before = engine.snapshot();
  expect(before.doc.components[0]?.board?.center).toEqual({ x: 125, y: 87 });
  start();
  click(57, 79);
  click(257, 79);
  confirm('5');
  expect(engine.snapshot().doc.components).toEqual(before.doc.components);
  expect(engine.snapshot().doc.components[0]?.board?.center).toEqual({ x: 125, y: 87 });
  expect(engine.snapshot().doc.scale.pxPerMm).toBe(20);
});

test('calibration_points_are_world_coordinates_under_rotated_scene', async () => {
  const { engine, execute, click, start } = await calibrationWorkspace({ transform: 'rot90' });
  start();
  // Literal projection: root(17,29) + pan(20,10) + 2 * rot90[400x300].
  click(597, 59);
  click(597, 259);
  confirm('5');
  expect(execute).toHaveBeenCalledExactlyOnceWith('photo.setScale', {
    a: { x: 10, y: 20 },
    b: { x: 110, y: 20 },
    mm: 5,
  });
  expect(engine.snapshot().doc.scale.pxPerMm).toBe(20);
});
