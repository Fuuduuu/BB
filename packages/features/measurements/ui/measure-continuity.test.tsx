// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../__tests__/workspace';

function measureBlock() {
  return within(screen.getByRole('region', { name: 'Mõõda' }));
}

function voltage() {
  return measureBlock().getByRole<HTMLInputElement>('textbox', { name: 'Pinge' });
}

function chooseReference(clickPin: (id: string) => void, id: string) {
  fireEvent.click(measureBlock().getByRole('button', { name: 'Vali musta sondi jalg' }));
  clickPin(id);
}

test('measure_block_saves_continuity_with_beep_buttons', () => {
  const { clickPin, engine } = mountMeasurements();
  clickPin('4');
  fireEvent.keyDown(voltage(), { key: '4', altKey: true });

  const beep = () => measureBlock().getByRole<HTMLButtonElement>('button', { name: 'Piiksub' });
  const noBeep = () => measureBlock().getByRole<HTMLButtonElement>('button', { name: 'Ei piiksu' });
  expect(beep().disabled).toBe(true);
  expect(noBeep().disabled).toBe(true);
  const mode = measureBlock().getByRole<HTMLSelectElement>('combobox', { name: 'Režiim' });
  expect(mode.value).toBe('continuity');
  expect(measureBlock().getByText('Alt+1 pinge · Alt+4 läbivus')).toBeTruthy();
  expect(measureBlock().getByText('Vali vastaspunkt')).toBeTruthy();
  expect(measureBlock().getByText('Enter piiksub · Alt+N ei piiksu')).toBeTruthy();
  expect(measureBlock().queryByRole('textbox', { name: 'Pinge' })).toBeNull();

  chooseReference(clickPin, '3');
  expect(document.activeElement).toBe(beep());
  fireEvent.keyDown(beep(), { key: '1', altKey: true });
  fireEvent.change(voltage(), { target: { value: '4,98' } });
  fireEvent.keyDown(voltage(), { key: '4', altKey: true });

  expect(beep().disabled).toBe(false);
  expect(noBeep().disabled).toBe(false);
  fireEvent.keyDown(beep(), { key: 'Enter' });
  expect(measureBlock().getByText('Läbivus · piiksub · U1.4 → U1.3')).toBeTruthy();
  fireEvent.keyDown(beep(), { key: 'n', altKey: true });
  expect(measureBlock().getByText('Läbivus · ei piiksu · U1.4 → U1.3')).toBeTruthy();
  expect(engine.snapshot().doc.measurements).toMatchObject([
    { mode: 'continuity', beep: true, at: pinRef('4'), ref: pinRef('3'), source: 'manual' },
    { mode: 'continuity', beep: false, at: pinRef('4'), ref: pinRef('3'), source: 'manual' },
  ]);

  fireEvent.keyDown(beep(), { key: '1', altKey: true });
  expect(voltage().value).toBe('4,98');
});

test('probe_pair_drafts_never_collide', () => {
  const { clickPin } = mountMeasurements({
    seed(doc) {
      const uids = ['pin_a|pin_b', 'pin_c', 'pin_a', 'pin_b|pin_c'];
      doc.components[0]!.pins.forEach((pin, index) => {
        pin.uid = uids[index]!;
      });
    },
  });

  clickPin('1');
  chooseReference(clickPin, '2');
  fireEvent.change(voltage(), { target: { value: '4,98' } });
  clickPin('3');
  chooseReference(clickPin, '4');
  expect(voltage().value).toBe('');
  fireEvent.change(voltage(), { target: { value: '3m3' } });

  clickPin('1');
  chooseReference(clickPin, '2');
  expect(voltage().value).toBe('4,98');
  clickPin('3');
  chooseReference(clickPin, '4');
  expect(voltage().value).toBe('3m3');
});
