// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useSessionStore } from '@pcbk/ui';
import { mountMeasurements, pinRef } from '../__tests__/workspace';
import { MeasureBlock } from './MeasureBlock';

function measureBlock() {
  return within(screen.getByRole('region', { name: 'Mõõda' }));
}

function voltage() {
  return measureBlock().getByRole<HTMLInputElement>('textbox', { name: 'Pinge' });
}

function power() {
  return measureBlock().getByRole<HTMLSelectElement>('combobox', { name: 'Toide' });
}

function save() {
  return measureBlock().getByRole<HTMLButtonElement>('button', { name: 'Salvesta' });
}

function typeVoltage(value: string) {
  voltage().focus();
  fireEvent.change(voltage(), { target: { value } });
}

function chooseReference(clickPin: (pinId: string) => void, pinId: string) {
  fireEvent.click(measureBlock().getByRole('button', { name: 'Vali jalg' }));
  clickPin(pinId);
}

test('black_probe_is_never_chosen_automatically', () => {
  const { clickPin, engine } = mountMeasurements();
  expect(screen.queryByRole('region', { name: 'Mõõda' })).toBeNull();
  clickPin('1');
  expect(measureBlock().getByText('U1.1')).toBeTruthy();
  expect(measureBlock().getByText('VIN')).toBeTruthy();
  expect(measureBlock().getByText('määramata')).toBeTruthy();
  typeVoltage('4,98');
  fireEvent.click(save());
  expect(engine.snapshot().doc.measurements[0]?.ref).toBeUndefined();
});

test('suggestion_sets_reference_only_after_click', () => {
  const { clickPin, engine } = mountMeasurements({
    pinnedRender: (ids) => <MeasureBlock ids={ids} suggestions={[pinRef('4')]} />,
  });
  clickPin('1');
  const suggestion = measureBlock().getByRole('button', { name: 'U1.4' });
  expect(measureBlock().getByText('määramata')).toBeTruthy();
  fireEvent.click(suggestion);
  expect(measureBlock().queryByText('määramata')).toBeNull();
  typeVoltage('4,98');
  fireEvent.click(save());
  expect(engine.snapshot().doc.measurements[0]?.ref).toEqual(pinRef('4'));
});

test('draft_belongs_to_probe_pair', () => {
  const { clickPin } = mountMeasurements();
  clickPin('1');
  typeVoltage('4,98');
  fireEvent.change(power(), { target: { value: 'on' } });
  chooseReference(clickPin, '4');
  expect(voltage().value).toBe('');
  expect(power().value).toBe('unknown');
  typeVoltage('3m3');
  fireEvent.change(power(), { target: { value: 'off' } });
  clickPin('2');
  expect(voltage().value).toBe('');
  expect(measureBlock().getByText('U1.4')).toBeTruthy();
  clickPin('1');
  expect(voltage().value).toBe('3m3');
  expect(power().value).toBe('off');
  fireEvent.click(measureBlock().getByRole('button', { name: 'Tühjenda' }));
  expect(voltage().value).toBe('4,98');
  expect(power().value).toBe('on');
});

test('alt_down_does_not_carry_value_to_next_pin', () => {
  const { clickPin, engine } = mountMeasurements();
  clickPin('1');
  typeVoltage('4,98');
  fireEvent.keyDown(voltage(), { key: 'ArrowDown', altKey: true });
  expect(measureBlock().getByText('U1.2')).toBeTruthy();
  expect(voltage().value).toBe('');
  expect(document.activeElement).toBe(voltage());
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'pin', id: '2', componentId: 'cmp_u1' },
  ]);
  expect(engine.snapshot().doc.measurements).toHaveLength(0);
  fireEvent.keyDown(voltage(), { key: 'ArrowUp', altKey: true });
  expect(voltage().value).toBe('4,98');
});

test('tab_does_not_change_location', () => {
  const { clickPin } = mountMeasurements();
  clickPin('1');
  typeVoltage('4,98');
  expect(fireEvent.keyDown(voltage(), { key: 'Tab' })).toBe(true);
  save().focus();
  expect(measureBlock().getByText('U1.1')).toBeTruthy();
  expect(voltage().value).toBe('4,98');
});

test('alt_down_stops_at_last_pin_no_wrap', () => {
  const { clickPin } = mountMeasurements();
  clickPin('4');
  typeVoltage('4,98');
  fireEvent.keyDown(voltage(), { key: 'ArrowDown', altKey: true });
  expect(measureBlock().getByText('U1.4')).toBeTruthy();
  expect(voltage().value).toBe('4,98');
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'pin', id: '4', componentId: 'cmp_u1' },
  ]);
});

test('enter_saves_and_clears_draft_and_keeps_focus', () => {
  const { clickPin, engine, host } = mountMeasurements();
  clickPin('1');
  chooseReference(clickPin, '4');
  typeVoltage('4,98');
  fireEvent.change(power(), { target: { value: 'on' } });
  fireEvent.keyDown(voltage(), { key: 'Enter' });
  expect(engine.snapshot().doc.measurements).toEqual([
    expect.objectContaining({
      at: pinRef('1'),
      ref: pinRef('4'),
      power: 'on',
      mode: 'voltage',
      value: 4.98,
      takenAt: expect.stringMatching(/Z$/),
    }),
  ]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['measurements.add']);
  expect(voltage().value).toBe('');
  expect(document.activeElement).toBe(voltage());
  clickPin('2');
  expect(power().value).toBe('on');
});

test('failed_save_retains_draft', () => {
  const { clickPin, engine } = mountMeasurements({ readOnly: true });
  clickPin('1');
  typeVoltage('4,98');
  fireEvent.change(power(), { target: { value: 'on' } });
  fireEvent.keyDown(voltage(), { key: 'Enter' });
  expect(engine.snapshot().doc.measurements).toHaveLength(0);
  expect(measureBlock().getByRole('alert').textContent).toContain('kirjutuskaitstud');
  expect(voltage().value).toBe('4,98');
  expect(power().value).toBe('on');
  clickPin('2');
  expect(power().value).toBe('unknown');
});

test('invalid_voltage_blocks_save_and_shows_reason', () => {
  const { clickPin, engine } = mountMeasurements();
  clickPin('1');
  const execute = vi.spyOn(engine, 'execute');
  fireEvent.click(save());
  expect(voltage().getAttribute('aria-invalid')).toBe('true');
  expect(measureBlock().getByText('Sisesta pinge, nt 4,98.')).toBeTruthy();
  typeVoltage('vale');
  fireEvent.keyDown(voltage(), { key: 'Enter' });
  expect(voltage().getAttribute('aria-invalid')).toBe('true');
  expect(
    measureBlock().getByText('Ei saa aru. Sisesta pinge voltides, nt 4,98 või 3m3.'),
  ).toBeTruthy();
  expect(execute).not.toHaveBeenCalled();
  execute.mockRestore();
  typeVoltage('0');
  expect(voltage().getAttribute('aria-invalid')).not.toBe('true');
  fireEvent.keyDown(voltage(), { key: 'Enter' });
  expect(engine.snapshot().doc.measurements[0]?.value).toBe(0);
});

test('deleted_probe_keeps_visible_draft_but_blocks_save', () => {
  const { clickPin, engine, host } = mountMeasurements();
  clickPin('1');
  typeVoltage('2');
  chooseReference(clickPin, '4');
  typeVoltage('4,98');
  act(() => {
    expect(engine.execute('components.removePin', { id: 'cmp_u1', pinId: '4' }).ok).toBe(true);
    expect(
      engine.execute('components.addPin', { id: 'cmp_u1', pin: { id: '4', uid: 'pin_new4' } }).ok,
    ).toBe(true);
  });
  expect(voltage().value).toBe('4,98');
  expect(
    measureBlock().getByText('Vastaspunkti jalg on kustutatud. Vali uus või tühjenda.'),
  ).toBeTruthy();
  expect(save().disabled).toBe(true);
  fireEvent.keyDown(voltage(), { key: 'Enter' });
  fireEvent.click(measureBlock().getByRole('button', { name: 'Tühjenda' }));
  expect(voltage().value).toBe('2');
  expect(save().disabled).toBe(false);
  act(() => {
    expect(engine.execute('components.removePin', { id: 'cmp_u1', pinId: '1' }).ok).toBe(true);
  });
  expect(voltage().value).toBe('2');
  expect(measureBlock().getByText('Mõõtmiskoha jalg on kustutatud. Vali uus jalg.')).toBeTruthy();
  expect(save().disabled).toBe(true);
  fireEvent.keyDown(voltage(), { key: 'Enter' });
  expect(engine.snapshot().doc.measurements).toHaveLength(0);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'components.removePin',
    'components.addPin',
    'components.removePin',
  ]);
});

test('both_deleted_contacts_are_reported', () => {
  const { clickPin, engine } = mountMeasurements();
  clickPin('1');
  chooseReference(clickPin, '4');
  typeVoltage('4,98');
  act(() => {
    expect(engine.execute('components.removePin', { id: 'cmp_u1', pinId: '1' }).ok).toBe(true);
    expect(engine.execute('components.removePin', { id: 'cmp_u1', pinId: '4' }).ok).toBe(true);
  });
  expect(voltage().value).toBe('4,98');
  const alert = measureBlock().getByRole('alert');
  expect(alert.textContent).toContain('Mõõtmiskoha jalg on kustutatud. Vali uus jalg.');
  expect(alert.textContent).toContain('Vastaspunkti jalg on kustutatud. Vali uus või tühjenda.');
});

test('no_canvas_hotkeys_fire_inside_input', () => {
  const { clickPin } = mountMeasurements();
  clickPin('1');
  typeVoltage('4,98');
  for (const key of ['h', 'm', ' ']) expect(fireEvent.keyDown(voltage(), { key })).toBe(true);
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(voltage().value).toBe('4,98');
  fireEvent.keyDown(voltage(), { key: 'Escape' });
  expect(voltage().value).toBe('');
  expect(document.activeElement).not.toBe(voltage());
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'pin', id: '1', componentId: 'cmp_u1' },
  ]);
});

test('alt_p_cycles_power', () => {
  const { clickPin } = mountMeasurements();
  clickPin('1');
  expect(power().value).toBe('unknown');
  for (const expected of ['on', 'off', 'unknown']) {
    fireEvent.keyDown(voltage(), { key: 'p', altKey: true });
    expect(power().value).toBe(expected);
  }
});
