// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { mountMeasurements } from '../__tests__/workspace';

const block = () => screen.getByRole('region', { name: 'Mõõda' });
const voltage = () => within(block()).getByRole<HTMLInputElement>('textbox', { name: 'Pinge' });
let styles: HTMLStyleElement;

beforeEach(() => {
  styles = document.createElement('style');
  styles.textContent = [
    'packages/ui/src/kit/tokens.css',
    'packages/features/measurements/ui/measure-block.css',
  ]
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  document.head.append(styles);
});

afterEach(() => styles.remove());

function save(value = '4,73') {
  fireEvent.change(voltage(), { target: { value } });
  fireEvent.keyDown(voltage(), { key: 'Enter' });
}

test('measure_input_uses_large_mono_value', () => {
  const { clickPin } = mountMeasurements();
  clickPin('4');
  fireEvent.change(voltage(), { target: { value: '4,68' } });
  const inputStyle = getComputedStyle(voltage());
  expect(voltage().value).toBe('4,68');
  expect(inputStyle.fontFamily).toContain('Martian Mono');
  expect(inputStyle.fontSize).toBe('20px');
  expect(inputStyle.fontVariantNumeric).toBe('tabular-nums');
  expect(within(block()).getByText('nt 4,98')).toBeTruthy();
});

test('last_saved_row_shows_value_and_probe_pair', () => {
  const { clickPin } = mountMeasurements();
  clickPin('4');
  fireEvent.click(within(block()).getByRole('button', { name: 'Vali musta sondi jalg' }));
  clickPin('3');
  save();
  clickPin('2');
  fireEvent.change(voltage(), { target: { value: '4,68' } });

  const saved = block().querySelector<HTMLElement>('.pcbk-last-saved');
  expect(saved).not.toBeNull();
  const title = within(saved!).getByText('Viimati salvestatud');
  const value = within(saved!).getByText('4,73 V');
  const pair = within(saved!).getByText('U1.4 → U1.3');
  expect(value.parentElement).toBe(pair.parentElement);
  expect(getComputedStyle(value.parentElement!).display).toBe('flex');
  expect(getComputedStyle(value.parentElement!).justifyContent).toBe('space-between');
  expect(getComputedStyle(value).fontSize).toBe('18px');
  expect(getComputedStyle(value).fontFamily).toContain('Martian Mono');
  expect(getComputedStyle(value).fontVariantNumeric).toBe('tabular-nums');
  expect(getComputedStyle(pair).fontSize).toBe('12px');
  expect(getComputedStyle(pair).fontFamily).toContain('Martian Mono');
  expect(getComputedStyle(title).fontSize).toBe('12px');
  expect(getComputedStyle(saved!).borderRadius).toBe('8px');
  expect(within(block()).queryByText('nt 4,98')).toBeNull();
  expect(voltage().value).toBe('4,68');
});

test('last_saved_block_announces_politely', () => {
  const { clickPin, engine } = mountMeasurements();
  clickPin('4');
  const live = block().querySelector<HTMLElement>('[aria-live="polite"]');
  expect(live).not.toBeNull();
  expect(live?.textContent).toBe('');
  expect(getComputedStyle(live!).display).not.toBe('none');
  expect(getComputedStyle(live!).visibility).not.toBe('hidden');
  expect(getComputedStyle(live!).position).toBe('absolute');
  save();
  const saved = block().querySelector<HTMLElement>('.pcbk-last-saved');
  expect(saved?.parentElement).toBe(live);
  expect(live?.getAttribute('aria-atomic')).toBe('true');
  expect(saved?.textContent).toContain('4,73 V');
  save();
  const repeated = block().querySelector<HTMLElement>('.pcbk-last-saved');
  expect(repeated).not.toBe(saved);
  expect(repeated?.textContent).toBe(saved?.textContent);
  expect(block().querySelector('[aria-live="polite"]')).toBe(live);
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(block().querySelector('[aria-live="polite"]')).toBe(live);
  expect(live?.textContent).toBe('');
  expect(live?.childElementCount).toBe(0);
  expect(getComputedStyle(live!).position).toBe('absolute');
  expect(within(block()).getByText('nt 4,98')).toBeTruthy();
  act(() => {
    expect(engine.redo().ok).toBe(true);
  });
  expect(block().querySelector('[aria-live="polite"]')).toBe(live);
  expect(live?.textContent).toContain('4,73 V');
});

test('last_saved_large_value_wraps_without_changing_numeric_reading', () => {
  const { clickPin, engine } = mountMeasurements();
  clickPin('4');
  const largeReading = '100000000000000000000000000000';
  save(largeReading);
  expect(engine.snapshot().doc.measurements[0]?.value).toBe(1e29);
  const saved = block().querySelector<HTMLElement>('.pcbk-last-saved')!;
  const value = within(saved).getByText(`${largeReading} V`);
  const pair = within(saved).getByText('U1.4');
  expect(value.parentElement).toBe(pair.parentElement);
  expect(getComputedStyle(value).fontSize).toBe('18px');
  expect(getComputedStyle(value).minWidth).toBe('0px');
  expect(getComputedStyle(value).flexShrink).toBe('1');
  expect(getComputedStyle(value).overflowWrap).toBe('anywhere');
  expect(getComputedStyle(value).textOverflow).not.toBe('ellipsis');
});
