// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { measurementDoc, mountMeasurements } from '../__tests__/workspace';
import { commandError } from './i18n/et';

test('ui_shows_internal_error_text', () => {
  expect(commandError({ code: 'internal', message: 'private implementation detail' })).toBe(
    'Sisemine viga, muudatust ei tehtud. Salvesta diagnostika ja anna veast teada.',
  );
});

const value = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Pinge' });
const pickRef = () => fireEvent.click(screen.getByRole('button', { name: 'Vali jalg' }));

test('blank_click_and_tab_change_keep_location_and_draft', () => {
  const { clickPin, clickBlank } = mountMeasurements();
  clickPin('1');
  fireEvent.change(value(), { target: { value: '4,98' } });
  clickBlank();
  fireEvent.click(screen.getByRole('tab', { name: 'Mõõtmised' }));
  expect(screen.getByText('U1.1')).toBeTruthy();
  expect(value().value).toBe('4,98');
});

test('measure_block_stays_visible_after_selection_cleared', () => {
  const { clickPin, clickBlank } = mountMeasurements();
  clickPin('1');
  clickBlank();
  expect(useSessionStore.getState().selection.items).toEqual([]);
  expect(screen.getByRole('heading', { name: 'Mõõda' })).toBeTruthy();
  expect(screen.queryByText('Vali komponent, et näha selle omadusi.')).toBeNull();
});

test('pick_ref_tool_sets_black_probe_and_esc_cancels', () => {
  const { clickPin, svg, engine } = mountMeasurements();
  clickPin('1');
  pickRef();
  expect(useSessionStore.getState().toolId).toBe('measurements.pickRef');
  clickPin('4');
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(screen.getByText('U1.1')).toBeTruthy();
  expect(screen.getByText('U1.4')).toBeTruthy();
  pickRef();
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(screen.getByText('U1.4')).toBeTruthy();
  expect(engine.snapshot().doc.measurements).toEqual([]);
});

test('m_key_focuses_value_field', () => {
  const { clickPin, clickBlank, svg } = mountMeasurements();
  clickPin('2');
  clickBlank();
  expect(document.activeElement).not.toBe(value());
  fireEvent.click(
    within(document.querySelector<HTMLElement>('.pcbk-topbar')!).getByRole('button', {
      name: 'Peida omadused',
    }),
  );
  expect(screen.queryByRole('complementary', { name: 'Omadused' })).toBeNull();
  fireEvent.keyDown(svg, { key: 'm' });
  expect(screen.getByRole('complementary', { name: 'Omadused' }).contains(value())).toBe(true);
  expect(document.activeElement).toBe(value());
});

test('o_key_topbar_and_m_on_pin_open_context', () => {
  const { clickPin, svg, engine } = mountMeasurements();
  act(() => useViewStore.getState().setContextOpen(false));
  clickPin('2');
  expect(screen.queryByRole('complementary', { name: 'Omadused' })).toBeNull();
  fireEvent.keyDown(svg, { key: 'o' });
  expect(screen.getByRole('heading', { name: 'Mõõda' })).toBeTruthy();
  const toggle = within(document.querySelector<HTMLElement>('.pcbk-topbar')!).getByRole('button', {
    name: 'Peida omadused',
  });
  fireEvent.click(toggle);
  expect(screen.queryByRole('complementary', { name: 'Omadused' })).toBeNull();
  fireEvent.click(toggle);
  expect(screen.getByRole('complementary', { name: 'Omadused' })).toBeTruthy();
  fireEvent.keyDown(svg, { key: 'o' });
  fireEvent.keyDown(svg, { key: 'm' });
  expect(screen.getByRole('complementary', { name: 'Omadused' })).toBeTruthy();
  expect(document.activeElement).toBe(value());
  expect(engine.snapshot().rev).toBe(0);
});

test('pinned_measure_section_does_not_reopen_hidden_context', () => {
  const { clickPin, clickBlank, svg } = mountMeasurements();
  act(() => useViewStore.getState().setContextOpen(false));
  clickPin('1');
  expect(screen.queryByRole('complementary', { name: 'Omadused' })).toBeNull();
  clickBlank();
  expect(useSessionStore.getState().selection.items).toEqual([]);
  const toggle = within(
    document.querySelector<HTMLElement>('.pcbk-topbar')!,
  ).getByRole<HTMLButtonElement>('button', { name: 'Näita omadusi' });
  expect(toggle.disabled).toBe(false);
  fireEvent.keyDown(svg, { key: 'o' });
  expect(screen.getByText('U1.1')).toBeTruthy();
  fireEvent.change(value(), { target: { value: '4,98' } });
  fireEvent.keyDown(svg, { key: 'o' });
  clickPin('2');
  expect(screen.queryByRole('complementary', { name: 'Omadused' })).toBeNull();
  fireEvent.keyDown(svg, { key: 'm' });
  expect(screen.getByText('U1.2')).toBeTruthy();
  expect(document.activeElement).toBe(value());
});

test('session_reset_clears_measure_store', () => {
  const { clickPin, host } = mountMeasurements();
  clickPin('1');
  pickRef();
  clickPin('4');
  fireEvent.change(value(), { target: { value: '4,98' } });
  act(() => host.load('next-project', measurementDoc(), false));
  expect(screen.queryByRole('heading', { name: 'Mõõda' })).toBeNull();
  clickPin('1');
  expect(value().value).toBe('');
  expect(screen.getByText('määramata')).toBeTruthy();
  pickRef();
  clickPin('4');
  expect(value().value).toBe('');
});
