// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useSessionStore } from '@pcbk/ui';
import { calibrationWorkspace } from '../__tests__/calibration-workspace';
import { useCalibrateStore } from './calibrate-store';

function confirm(mm: string) {
  const dialog = within(screen.getByRole('dialog', { name: 'Kui pikk see lõik on?' }));
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
  expect(screen.queryByRole('dialog', { name: 'Kui pikk see lõik on?' })).toBeNull();
  click(257, 79);
  const dialog = screen.getByRole('dialog', { name: 'Kui pikk see lõik on?' });
  expect(within(dialog).getByText('Punktide vahe: 100,0 px')).toBeTruthy();
  expect(within(dialog).getByRole('textbox', { name: 'Vahe millimeetrites' })).toBe(
    document.activeElement,
  );
  expect(execute).not.toHaveBeenCalled();
});

test('window_blur_keeps_calibration_draft', async () => {
  const { engine, execute, click, start } = await calibrationWorkspace();
  const a = { x: 10, y: 20 };
  const b = { x: 110, y: 20 };
  start();
  click(57, 79);
  click(257, 79);
  const dialog = screen.getByRole('dialog', { name: 'Kui pikk see lõik on?' });
  const input = within(dialog).getByRole<HTMLInputElement>('textbox', {
    name: 'Vahe millimeetrites',
  });
  fireEvent.change(input, { target: { value: '17' } });
  fireEvent(window, new Event('blur'));

  expect(useSessionStore.getState().toolId).toBe('photo.calibrate');
  expect(useCalibrateStore.getState()).toMatchObject({ a, b, dialogOpen: true });
  expect(screen.getByRole('dialog', { name: 'Kui pikk see lõik on?' })).toBe(dialog);
  expect(input.value).toBe('17');
  expect(execute).not.toHaveBeenCalled();

  // jsdom does not perform the default form submission on Enter.
  if (fireEvent.keyDown(input, { key: 'Enter' })) fireEvent.submit(input.form!);
  expect(execute).toHaveBeenCalledExactlyOnceWith('photo.setScale', { a, b, mm: 17 });
  expect(engine.snapshot().doc.scale.pxPerMm).toBeCloseTo(100 / 17);
  expect(screen.queryByRole('dialog', { name: 'Kui pikk see lõik on?' })).toBeNull();
});

test('window_blur_cancels_temporary_pan_without_clearing_calibration_point', async () => {
  const { execute, click, pointer, start } = await calibrationWorkspace();
  start();
  click(57, 79);
  const a = { x: 10, y: 20 };
  expect(useCalibrateStore.getState().a).toEqual(a);
  pointer('pointerdown', 157, 139, 1);
  pointer('pointermove', 207, 149, 1);
  fireEvent(window, new Event('blur'));
  pointer('pointerup', 207, 149, 1);
  expect(useCalibrateStore.getState()).toMatchObject({ a, b: null, dialogOpen: false });
  expect(useSessionStore.getState().toolId).toBe('photo.calibrate');
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
  expect(screen.queryByRole('dialog', { name: 'Kui pikk see lõik on?' })).toBeNull();
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

test('calibration_preview_shows_scale_and_photo_size', async () => {
  const first = await calibrationWorkspace();
  first.start();
  first.click(57, 79);
  first.click(257, 79);

  function enter(mm: string) {
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByRole('textbox', { name: 'Vahe millimeetrites' });
    fireEvent.change(input, { target: { value: mm } });
    const output = dialog.querySelector('output[aria-live="polite"]');
    expect(output).not.toBeNull();
    return output!.textContent;
  }

  const ten = enter('10');
  expect(ten).toContain('= 10,00 px/mm · 1 px = 100 µm');
  expect(ten).toContain('Foto: 40 × 30 mm');
  const pitch = enter('2,54');
  expect(pitch).toContain('= 39,37 px/mm · 1 px = 25 µm');
  expect(pitch).toContain('Foto: 10 × 7,6 mm');
  expect(enter('0')).toBe('');
  expect(enter('abc')).toBe('');
  expect(screen.getByRole('dialog', { name: 'Kui pikk see lõik on?' })).toBeTruthy();
  expect(first.execute).not.toHaveBeenCalled();

  cleanup();
  const rotated = await calibrationWorkspace({ transform: 'rot90' });
  rotated.start();
  rotated.click(597, 59);
  rotated.click(597, 259);
  const turned = enter('10');
  expect(turned).toContain('= 10,00 px/mm · 1 px = 100 µm');
  expect(turned).toContain('Foto: 30 × 40 mm');

  cleanup();
  const unpictured = await calibrationWorkspace({ withPhoto: false });
  unpictured.start();
  unpictured.click(57, 79);
  unpictured.click(257, 79);
  const withoutPhoto = enter('10');
  expect(withoutPhoto).toContain('= 10,00 px/mm · 1 px = 100 µm');
  expect(withoutPhoto).not.toContain('Foto:');
});

test('calibration_quick_choice_fills_without_confirming', async () => {
  const { start, click, execute } = await calibrationWorkspace();
  start();
  click(57, 79);
  click(257, 79);
  const dialog = screen.getByRole('dialog');
  const form = within(dialog);
  const input = form.getByRole<HTMLInputElement>('textbox', { name: 'Vahe millimeetrites' });
  const choice = form.getByRole('button', { name: '25,4 mm' });
  choice.focus();
  fireEvent.click(choice);

  expect(input.value).toBe('25,4');
  expect(document.activeElement).toBe(input);
  expect(execute).not.toHaveBeenCalled();
  expect(dialog.querySelector('output[aria-live="polite"]')?.textContent).toContain(
    '= 3,94 px/mm · 1 px = 254 µm',
  );

  // jsdom does not perform the default form submission on Enter.
  if (fireEvent.keyDown(input, { key: 'Enter' })) fireEvent.submit(input.form!);
  expect(execute).toHaveBeenCalledExactlyOnceWith('photo.setScale', {
    a: { x: 10, y: 20 },
    b: { x: 110, y: 20 },
    mm: 25.4,
  });
  expect(screen.queryByRole('dialog')).toBeNull();
});
