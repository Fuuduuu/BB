// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { mountMeasurements } from '../__tests__/workspace';
import { useMeasureStore } from './measure-store';

const block = () => within(screen.getByRole('region', { name: 'Mõõda' }));
const voltage = () => block().getByRole<HTMLInputElement>('textbox', { name: 'Pinge' });
function pickBlack(clickPin: (id: string) => void, id: string) {
  fireEvent.click(block().getByRole('button', { name: /^Vali (musta sondi )?jalg$/ }));
  clickPin(id);
}
function save(value = '4,73') {
  voltage().focus();
  fireEvent.change(voltage(), { target: { value } });
  fireEvent.keyDown(voltage(), { key: 'Enter' });
}

test('probe_rows_name_red_and_black_pins', () => {
  const { clickPin } = mountMeasurements({
    seed(doc) {
      doc.components[0]!.pins[3]!.name = 'VCC';
      doc.components[0]!.pins[2]!.name = 'GND';
    },
  });
  clickPin('4');
  const red = block().getByRole('group', { name: 'Punane sond' });
  expect(red.textContent).toContain('Punane sond · U1.4');
  expect(within(red).getByText('VCC')).toBeTruthy();
  expect(block().getByRole('group', { name: 'Must sond' }).textContent).toContain(
    'Must sond · määramata',
  );
  pickBlack(clickPin, '3');
  const black = block().getByRole('group', { name: 'Must sond' });
  expect(black.textContent).toContain('Must sond · U1.3');
  expect(within(black).getByText('GND')).toBeTruthy();
  expect(within(black).getByRole('button', { name: 'Vali musta sondi jalg' })).toBeTruthy();
});

test('black_probe_row_highlights_while_picking', () => {
  const { clickPin } = mountMeasurements();
  clickPin('4');
  const black = block().getByRole('group', { name: 'Must sond' });
  fireEvent.click(within(black).getByRole('button', { name: 'Vali musta sondi jalg' }));
  expect(black.getAttribute('data-picking')).toBe('true');
  expect(within(black).getByText('Klõpsa plaadil musta sondi jalal')).toBeTruthy();
  clickPin('3');
  expect(black.getAttribute('data-picking')).toBe('false');
  expect(within(black).queryByText('Klõpsa plaadil musta sondi jalal')).toBeNull();
  expect(black.textContent).toContain('Must sond · U1.3');
});

test('last_saved_reading_follows_undo', () => {
  const { clickPin, engine } = mountMeasurements();
  clickPin('4');
  pickBlack(clickPin, '3');
  expect(block().getByText('nt 4,98')).toBeTruthy();
  save();
  const saved = 'Viimati salvestatud 4,73 V · U1.4 → U1.3';
  expect(block().getByText(saved)).toBeTruthy();
  expect(block().queryByText('nt 4,98')).toBeNull();
  expect(voltage().value).toBe('');
  expect(document.activeElement).toBe(voltage());
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(block().queryByText(saved)).toBeNull();
  expect(block().getByText('nt 4,98')).toBeTruthy();
  act(() => {
    expect(engine.redo().ok).toBe(true);
  });
  expect(block().getByText(saved)).toBeTruthy();
});

test('last_saved_reading_shows_saved_pair_not_current_probes', () => {
  const { clickPin } = mountMeasurements();
  clickPin('4');
  pickBlack(clickPin, '3');
  save();
  clickPin('2');
  pickBlack(clickPin, '1');
  expect(block().getByRole('group', { name: 'Punane sond' }).textContent).toContain('U1.2');
  expect(block().getByRole('group', { name: 'Must sond' }).textContent).toContain('U1.1');
  expect(block().getByText('Viimati salvestatud 4,73 V · U1.4 → U1.3')).toBeTruthy();
});

test('last_saved_without_black_probe_is_cleared_on_session_reset', () => {
  const { clickPin } = mountMeasurements();
  clickPin('4');
  save('3m3');
  expect(block().getByText('Viimati salvestatud 3,3 mV · U1.4')).toBeTruthy();
  expect(useMeasureStore.getState().lastSavedId).toBeTruthy();
  act(() => useMeasureStore.getState().reset());
  expect(useMeasureStore.getState().lastSavedId).toBeNull();
});

test('failed_save_does_not_set_last_saved_id', () => {
  const { clickPin } = mountMeasurements({ readOnly: true });
  clickPin('4');
  save();
  expect(useMeasureStore.getState().lastSavedId).toBeNull();
  expect(block().getByText('nt 4,98')).toBeTruthy();
  expect(voltage().value).toBe('4,73');
});
