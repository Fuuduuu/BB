// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useSessionStore } from '@pcbk/ui';
import { COMPONENT_LIBRARY, type LibraryEntry } from '../contract';
import { Library } from './Library';
import { compatiblePlacement } from './placement';
import { usePlaceStore } from './place-store';

afterEach(() => {
  cleanup();
  usePlaceStore.getState().reset();
  useSessionStore.getState().reset('');
});

test('library_has_40_entries_in_prototype_order', () => {
  expect(COMPONENT_LIBRARY.map(({ id }) => id)).toEqual([
    'r_smd',
    'c_smd',
    'l_smd',
    'f_smd',
    'c_tant',
    'c_elsmd',
    'r_tht',
    'c_disc',
    'c_el',
    'd_smd',
    'd_tht',
    'led_smd',
    'led_tht',
    'sot23',
    'sot223',
    'dpak',
    'to92',
    'to220',
    'soic',
    'tssop',
    'dip',
    'qfp',
    'qfn',
    'hdr1',
    'hdr2',
    'jst',
    'term',
    'usbc',
    'musb',
    'dcjack',
    'xtal',
    'xtal_smd',
    'btn',
    'pot',
    'custom',
    'unknown',
    'tp',
    'via',
    'pad',
    'wire',
    'hole',
  ]);
});

test('library_groups_entries_by_category_and_hides_empty_groups_on_search', () => {
  render(<Library />);
  expect(screen.getAllByRole('heading').map(({ textContent }) => textContent)).toEqual([
    'Passiivsed',
    'Pooljuhid',
    'Mikroskeemid',
    'Konnektorid',
    'Muud',
    'Punktid plaadil',
  ]);
  expect(screen.getAllByRole('listitem')).toHaveLength(41);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'testpunkt' } });
  expect(screen.getAllByRole('heading').map(({ textContent }) => textContent)).toEqual([
    'Punktid plaadil',
  ]);
  expect(screen.getByRole('button', { name: 'Testpunkt' })).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});

test('param_spec_drives_library_fields', () => {
  render(<Library />);
  fireEvent.click(screen.getByRole('button', { name: 'Takisti SMD' }));
  const chip = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Korpus' });
  expect(Array.from(chip.options, ({ value }) => value)).toEqual([
    '0402',
    '0603',
    '0805',
    '1206',
    '1210',
    '2010',
    '2512',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'QFP' }));
  expect(screen.getByRole('combobox', { name: 'Jalgu' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Samm' })).toBeTruthy();
  const body = screen.getByLabelText<HTMLInputElement>('Kere (mm, 0 = auto)');
  expect(body.value).toBe('0');
  const place = screen.getByRole<HTMLButtonElement>('button', { name: 'Paiguta' });
  fireEvent.change(body, { target: { value: '0,15' } });
  expect(body.value).toBe('0,15');
  expect(place.disabled).toBe(true);
  fireEvent.change(body, { target: { value: '40.1' } });
  expect(place.disabled).toBe(true);
  fireEvent.change(body, { target: { value: '-' } });
  expect(body.value).toBe('-');
  expect(place.disabled).toBe(true);
  fireEvent.click(place);
  expect(usePlaceStore.getState().request).toBeNull();
  fireEvent.change(body, { target: { value: '0' } });
  fireEvent.click(place);
  expect(usePlaceStore.getState().request).toEqual({
    mode: 'new',
    entryId: 'qfp',
    params: { pins: 44, pitch: 0.8, body: 0 },
  });
});

test('numeric_pin_spec_keeps_draft_and_requires_a_whole_pin_count', () => {
  render(<Library />);
  fireEvent.click(screen.getByRole('button', { name: 'Pinnirida 2×N' }));
  const pairs = screen.getByLabelText<HTMLInputElement>('Paare');
  const place = screen.getByRole<HTMLButtonElement>('button', { name: 'Paiguta' });
  for (const value of ['', '0', '41', '2.5']) {
    fireEvent.change(pairs, { target: { value } });
    expect(pairs.value).toBe(value);
    expect(place.disabled).toBe(true);
  }
  fireEvent.change(pairs, { target: { value: '40' } });
  fireEvent.click(place);
  expect(usePlaceStore.getState().request).toEqual({
    mode: 'new',
    entryId: 'hdr2',
    params: { pins: 40, pitch: 2.54 },
  });
});

test('compatible_placement_reads_pin_counts_from_param_spec', () => {
  const entry = COMPONENT_LIBRARY.find(({ id }) => id === 'sot23')!;
  const pins = ['6', '4', '2', '5', '1', '3'].map((id) => ({ id }));
  const limited: LibraryEntry = {
    ...entry,
    paramSpec: [{ key: 'pins', label: 'pins', choices: [3, 5] }],
  };
  expect(compatiblePlacement(limited, pins)).toHaveProperty('reason');
  expect(compatiblePlacement(entry, pins)).toEqual({ params: { pins: 6 } });
  const header = COMPONENT_LIBRARY.find(({ id }) => id === 'hdr1')!;
  expect(compatiblePlacement(header, pins)).toEqual({ params: { pins: 6, pitch: 2.54 } });
});

test('compatible_placement_matches_candidate_pad_ids_for_pairs_and_extra_pads', () => {
  const pins = (ids: string[]) => ids.map((id) => ({ id }));
  const entry = (id: string) => COMPONENT_LIBRARY.find((value) => value.id === id)!;
  expect(compatiblePlacement(entry('hdr2'), pins(['1', '2', '3', '4', '5', '6']))).toEqual({
    params: { pins: 3, pitch: 2.54 },
  });
  const jst = { ...entry('jst'), params: { series: 'SH 1.0', pins: 3 } };
  expect(compatiblePlacement(jst, pins(['1', '2', '3', '4', 'MP1', 'MP2']))).toEqual({
    params: { series: 'SH 1.0', pins: 4 },
  });
  expect(compatiblePlacement(jst, pins(['1', '2', '3', '4', '5', '6']))).toHaveProperty('reason');
  expect(
    compatiblePlacement(entry('qfn'), pins(Array.from({ length: 17 }, (_, i) => String(i + 1)))),
  ).toEqual({
    params: { pins: 16, pitch: 0.5, ep: 'jah', body: 0 },
  });
});
