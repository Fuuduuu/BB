// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import type { ProjectService } from '@pcbk/contracts';
import type { BoardDoc, Vec2 } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import { photoUiFixture } from '../__tests__/ui-fixture';
import { CalibrationDialog } from './CalibrationDialog';
import { useCalibrateStore } from './calibrate-store';
import { createPhotoUi } from './index';

const open: ProjectService[] = [];
const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
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
afterEach(async () => {
  cleanup();
  useCalibrateStore.getState().reset();
  useSessionStore.getState().setToolId('select');
  vi.restoreAllMocks();
  for (const name of ['showModal', 'close'] as const) {
    const original = dialogMethods[name];
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[name];
  }
  for (const projects of open.splice(0)) await projects.discard();
});

function points(a: Vec2 = { x: 10, y: 20 }, b: Vec2 = { x: 35.4, y: 20 }) {
  useSessionStore.getState().setToolId('photo.calibrate');
  useCalibrateStore.getState().setA(a);
  useCalibrateStore.getState().setB(b);
}

async function fixture(a?: Vec2, b?: Vec2) {
  const { engine, host, projects } = photoUiFixture();
  open.push(projects);
  expect((await projects.create({ name: 'Kalibreerimine' })).ok).toBe(true);
  points(a, b);
  render(
    <EngineProvider engine={engine} projects={projects}>
      <CalibrationDialog />
    </EngineProvider>,
  );
  return { engine, host, execute: vi.spyOn(engine, 'execute') };
}

function submit(value: string) {
  const input = screen.getByRole('textbox', { name: 'Vahe millimeetrites' });
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest('form')!);
}

test.each([' 2,54 ', ' 2.54 '])('calibration_accepts_decimal_comma (%s)', async (value) => {
  const { engine, execute } = await fixture();
  const before = engine.snapshot();
  expect(screen.getByRole('dialog', { name: 'Kalibreeri mõõtkava' })).toBeTruthy();
  expect(screen.getByText('Punktide vahe: 25,4 px')).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Vahe millimeetrites' }));
  submit(value);
  expect(execute).toHaveBeenCalledExactlyOnceWith('photo.setScale', {
    a: { x: 10, y: 20 },
    b: { x: 35.4, y: 20 },
    mm: 2.54,
  });
  expect(engine.snapshot().doc.scale.pxPerMm).toBeCloseTo(10);
  expect(engine.snapshot().rev).toBe(before.rev + 1);
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(useCalibrateStore.getState()).toMatchObject({
    a: null,
    b: null,
    cursor: null,
    dialogOpen: false,
    error: null,
  });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test.each(['', ' ', 'abc', '0', '-1', '1000.01', 'Infinity', 'NaN', '1,2.3'])(
  'calibration_invalid_mm_sends_no_command (%s)',
  async (value) => {
    const { engine, execute } = await fixture();
    const before = engine.snapshot();
    submit(value);
    const input = screen.getByRole('textbox', { name: 'Vahe millimeetrites' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Sisesta vahe millimeetrites, nt 2,54.',
    );
    expect(execute).not.toHaveBeenCalled();
    expect(engine.snapshot()).toBe(before);
    expect(screen.getByRole('dialog')).toBeTruthy();
  },
);

test.each([
  [{ x: 13, y: 20 }, '2', 'Punktid on liiga lähestikku. Vali kaugemal olevad punktid.'],
  [{ x: 30, y: 20 }, '1000', 'Mõõtkava tuli ebausutav. Kontrolli punkte ja millimeetreid.'],
] as const)('calibration_rejection_shows_reason_and_keeps_dialog (%j)', async (b, mm, reason) => {
  const { engine, execute } = await fixture({ x: 10, y: 20 }, b);
  const before = engine.snapshot();
  submit(mm);
  expect(screen.getByRole('alert').textContent).toBe(reason);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(mm);
  expect(useCalibrateStore.getState()).toMatchObject({
    a: { x: 10, y: 20 },
    b,
    dialogOpen: true,
  });
  expect(useSessionStore.getState().toolId).toBe('photo.calibrate');
  expect(engine.snapshot()).toBe(before);
  expect(execute).toHaveBeenCalledTimes(1);
});

test('calibration_retries_after_rejection_with_same_points', async () => {
  const { engine, execute } = await fixture();
  submit('1000');
  expect(screen.getByRole('alert')).toBeTruthy();
  submit('2,54');
  expect(engine.snapshot().doc.scale.pxPerMm).toBeCloseTo(10);
  expect(execute).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test.each(['escape', 'cancel', 'close'])(
  'escape_cancels_calibration_without_command (%s)',
  async (how) => {
    const { engine, execute } = await fixture();
    const before = engine.snapshot();
    act(() => useCalibrateStore.getState().setError('Viga'));
    if (how === 'escape')
      fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    else
      fireEvent.click(screen.getByRole('button', { name: how === 'cancel' ? 'Loobu' : 'Sulge' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useCalibrateStore.getState()).toMatchObject({
      a: null,
      b: null,
      cursor: null,
      dialogOpen: false,
      error: null,
    });
    expect(useSessionStore.getState().toolId).toBe('select');
    expect(execute).not.toHaveBeenCalled();
    expect(engine.snapshot()).toBe(before);
  },
);

test('calibration_new_attempt_starts_with_empty_input', async () => {
  await fixture();
  submit('invalid');
  fireEvent.click(screen.getByRole('button', { name: 'Loobu' }));
  act(() => points());
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  expect(screen.queryByText('Sisesta vahe millimeetrites, nt 2,54.')).toBeNull();
});

test('calibration_read_only_error_keeps_dialog_and_points', async () => {
  const { engine, host, execute } = await fixture();
  const before = engine.snapshot();
  act(() => host.load(before.sessionId, structuredClone(before.doc) as BoardDoc, true));
  const readOnly = engine.snapshot();
  submit('2.54');
  expect(screen.getByRole('alert').textContent).toBe('Projekt on kirjutuskaitstud.');
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(engine.snapshot()).toBe(readOnly);
  expect(execute).toHaveBeenCalledTimes(1);
});

test('photo_module_registers_calibration_and_resets_session_state', () => {
  points();
  useCalibrateStore.getState().setCursor({ x: 12, y: 14 });
  useCalibrateStore.getState().setError('Viga');
  const module = createPhotoUi();
  expect(module.tools?.some((tool) => tool.id === 'photo.calibrate' && tool.key === 'K')).toBe(
    true,
  );
  expect(module.canvasLayers?.some((layer) => layer.id === 'photo.calibration')).toBe(true);
  module.onSessionReset?.();
  expect(useCalibrateStore.getState()).toMatchObject({
    a: null,
    b: null,
    cursor: null,
    dialogOpen: false,
    error: null,
  });
});
