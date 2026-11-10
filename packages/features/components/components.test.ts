import { newBoardDoc } from '@pcbk/domain';
import type { AddComponentParams } from './contract';
import { expect, test } from 'vitest';
import * as contract from './contract';
import { idGenerator, setup } from '../__tests__/helpers';

const add = (id = 'cmp_a', ref?: string): AddComponentParams => ({
  id,
  kind: 'resistor',
  ref,
  pins: [
    { id: '1', uid: `pin_${id}_1` },
    { id: '2', uid: `pin_${id}_2` },
  ],
});

test('add without ref gets R1 then R2 and explicit references are preserved', () => {
  const { engine } = setup();
  expect(engine.execute('components.add', add()).ok).toBe(true);
  expect(engine.execute('components.add', add('cmp_b')).ok).toBe(true);
  expect(engine.execute('components.add', add('cmp_c', 'R8')).ok).toBe(true);
  expect(engine.snapshot().doc.components.map((item) => item.ref)).toEqual(['R1', 'R2', 'R8']);
});
test('add leaves unknown values empty and component unplaced in both views', () => {
  const { engine } = setup();
  engine.execute('components.add', add());
  expect(engine.snapshot().doc.components[0]).toEqual({
    id: 'cmp_a',
    kind: 'resistor',
    ref: 'R1',
    marking: '',
    value: '',
    note: '',
    identified: false,
    dnp: false,
    pins: [
      { id: '1', uid: 'pin_cmp_a_1', nc: false },
      { id: '2', uid: 'pin_cmp_a_2', nc: false },
    ],
  });
  expect(engine.snapshot().derived.unplacedBoard).toEqual(['cmp_a']);
  expect(engine.snapshot().derived.unplacedSchematic).toEqual(['cmp_a']);
});
test('add accepts explicit marking and value', () => {
  const { engine } = setup();
  engine.execute('components.add', { ...add(), marking: '103', value: '10 kΩ' });
  expect(engine.snapshot().doc.components[0]).toMatchObject({ marking: '103', value: '10 kΩ' });
});
test('update changes only supplied component fields and undo restores the original', () => {
  const { engine } = setup();
  engine.execute('components.add', add());
  const original = engine.snapshot().doc.components[0];
  expect(
    engine.execute('components.update', {
      id: 'cmp_a',
      ref: 'C7',
      kind: 'capacitor',
      marking: '104',
      value: '100 nF',
      note: 'Kontrollitud',
      identified: true,
      dnp: true,
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.components[0]).toEqual({
    ...original,
    ref: 'C7',
    kind: 'capacitor',
    marking: '104',
    value: '100 nF',
    note: 'Kontrollitud',
    identified: true,
    dnp: true,
  });
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]).toEqual(original);
});
test('update to an existing case-insensitive ref is rejected without changing history', () => {
  const { engine, host } = setup();
  engine.execute('components.add', add());
  engine.execute('components.add', add('cmp_b'));
  const before = engine.snapshot();
  const journal = host.drainJournal();
  host.requeueJournal(journal);
  expect(engine.execute('components.update', { id: 'cmp_b', ref: 'r1' })).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual(journal);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components.map((item) => item.id)).toEqual(['cmp_a']);
});
test('empty component update preserves revision and redo', () => {
  const { engine } = setup();
  engine.execute('components.add', add());
  engine.execute('components.update', { id: 'cmp_a', value: '10k' });
  engine.undo();
  const before = engine.snapshot();
  expect(engine.execute('components.update', { id: 'cmp_a', value: undefined })).toEqual({
    ok: true,
    value: { rev: 3 },
  });
  expect(engine.snapshot()).toBe(before);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.value).toBe('10k');
});
test('items.delete then undo restores the same pin uids', () => {
  const { engine } = setup();
  engine.execute('components.add', add());
  engine.execute('items.delete', { ids: ['cmp_a'] });
  expect(engine.snapshot().doc.components).toEqual([]);
  engine.undo();
  expect(engine.snapshot().doc.components[0]!.pins.map((pin) => pin.uid)).toEqual([
    'pin_cmp_a_1',
    'pin_cmp_a_2',
  ]);
});
test('selectors expose the shared readonly snapshot and an absent component is undefined', () => {
  const { engine } = setup();
  engine.execute('components.add', add());
  const snapshot = engine.snapshot();
  expect(contract.selectComponents(snapshot)).toBe(snapshot.doc.components);
  expect(contract.selectComponent(snapshot, 'cmp_a')).toBe(snapshot.doc.components[0]);
  expect(contract.selectComponent(snapshot, 'cmp_absent')).toBeUndefined();
});
test('makeAddComponent creates component and pin identities using the caller generator', () => {
  expect(contract.makeAddComponent).toBeTypeOf('function');
  expect(contract.makeAddComponent(idGenerator(), 'ic', 3)).toEqual({
    id: 'cmp_1',
    kind: 'ic',
    pins: [
      { id: '1', uid: 'pin_2' },
      { id: '2', uid: 'pin_3' },
      { id: '3', uid: 'pin_4' },
    ],
  });
  const { engine } = setup();
  expect(
    engine.execute('components.add', contract.makeAddComponent(idGenerator(), 'resistor')).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.components[0]!.pins).toHaveLength(2);
});
test('makeAddComponent never creates pins for a mechanical hole', () => {
  expect(contract.makeAddComponent).toBeTypeOf('function');
  expect(contract.makeAddComponent(idGenerator(), 'hole', 3).pins).toEqual([]);
});
test.each([
  { ...add(), id: 'wrong_id' },
  { ...add(), ref: '  ' },
  { ...add(), kind: 'not-a-kind' },
  {
    ...add(),
    pins: [
      { id: '1', uid: 'pin_1' },
      { id: '1', uid: 'pin_2' },
    ],
  },
  { ...add(), pins: [{ id: '1', uid: 'wrong_uid' }] },
])('invalid component input %# is rejected atomically', (params) => {
  const { engine, host } = setup();
  const before = engine.snapshot();
  expect(engine.execute('components.add', params as never)).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});
test('component commands cannot replace pins or placements through update', () => {
  const { engine } = setup(newBoardDoc('Plaat'));
  engine.execute('components.add', add());
  const before = engine.snapshot();
  expect(engine.execute('components.update', { id: 'cmp_a', pins: [] } as never)).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
});

const chipBoard = { footprint: 'chip', center: { x: 20, y: 35 } };

test('add_with_board_creates_pins_from_footprint', () => {
  const { engine } = setup();
  const entry = {
    id: 'sot23',
    kind: 'npn',
    footprint: 'sot23',
    params: { pins: 3 },
    kw: 'transistor mosfet',
  } as const;
  expect(contract.makePlacedComponent).toBeTypeOf('function');
  const params = contract.makePlacedComponent(idGenerator(), entry, { pins: 5 }, chipBoard.center);
  expect(engine.execute('components.add', params).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]).toMatchObject({
    id: 'cmp_1',
    ref: 'Q1',
    pins: [
      { id: '1', uid: 'pin_2', nc: false },
      { id: '2', uid: 'pin_3', nc: false },
      { id: '3', uid: 'pin_4', nc: false },
      { id: '4', uid: 'pin_5', nc: false },
      { id: '5', uid: 'pin_6', nc: false },
    ],
    board: {
      footprint: 'sot23',
      params: { pins: 5 },
      center: { x: 20, y: 35 },
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    },
  });
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual([]);
});

test('library_has_seven_entries_with_empty_value_and_marking', () => {
  const { engine } = setup();
  expect(contract.COMPONENT_LIBRARY).toEqual([
    {
      id: 'r_smd',
      kind: 'resistor',
      footprint: 'chip',
      params: { size: '0805' },
      kw: 'resistor chip',
    },
    {
      id: 'c_smd',
      kind: 'capacitor',
      footprint: 'chip',
      params: { size: '0805' },
      kw: 'capacitor mlcc',
    },
    { id: 'sot23', kind: 'npn', footprint: 'sot23', params: { pins: 3 }, kw: 'transistor mosfet' },
    { id: 'soic', kind: 'ic', footprint: 'soic', params: { pins: 8, body: 3.9 }, kw: 'so ic' },
    { id: 'to220', kind: 'regulator', footprint: 'to220', params: {}, kw: 'regulator mosfet' },
    {
      id: 'hdr1',
      kind: 'connector',
      footprint: 'header1',
      params: { pins: 4, pitch: 2.54 },
      kw: 'header pin',
    },
    {
      id: 'unknown',
      kind: 'other',
      footprint: 'area',
      params: { w: 8, h: 10 },
      kw: 'unknown generic custom',
    },
  ]);
  const ids = idGenerator();
  for (const entry of contract.COMPONENT_LIBRARY) {
    const params = contract.makePlacedComponent(ids, entry, {}, chipBoard.center);
    expect(engine.execute('components.add', params).ok).toBe(true);
  }
  const components = engine.snapshot().doc.components;
  expect(components.map(({ value, marking }) => [value, marking])).toEqual(
    Array.from({ length: 7 }, () => ['', '']),
  );
  expect(components[6]!.pins).toEqual([]);
});

test.each([
  { pins: [{ id: '1', uid: 'pin_1' }] },
  {
    pins: [
      { id: '1', uid: 'pin_1' },
      { id: '3', uid: 'pin_2' },
    ],
  },
  { pins: [...add().pins, { id: '3', uid: 'pin_3' }] },
])('add_with_board_rejects_pin_mismatch %#', ({ pins }) => {
  const { engine } = setup();
  const before = engine.snapshot();
  expect(engine.execute('components.add', { ...add(), pins, board: chipBoard })).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'footprint_pins_mismatch' }] },
  });
  expect(engine.snapshot()).toBe(before);
});

test.each([
  { ...chipBoard, footprint: 'unknown' },
  { ...chipBoard, params: { size: '9999' } },
  { ...chipBoard, params: { size: '0805', extra: 1 } },
  { ...chipBoard, params: { size: true } },
  { ...chipBoard, params: { size: Number.POSITIVE_INFINITY } },
  { ...chipBoard, footprint: 'area', params: { w: 0 } },
])('invalid_footprint_params_are_rejected %#', (board) => {
  const { engine } = setup();
  const before = engine.snapshot();
  expect(engine.execute('components.add', { ...add(), board } as AddComponentParams)).toMatchObject(
    {
      ok: false,
      error: { code: 'validation', issues: [{ message: 'invalid_footprint' }] },
    },
  );
  expect(engine.snapshot()).toBe(before);
});

test('makePlacedComponent forwards invalid footprint params to command validation', () => {
  const { engine } = setup();
  expect(contract.COMPONENT_LIBRARY).toBeDefined();
  const entry = contract.COMPONENT_LIBRARY[2]!;
  const params = contract.makePlacedComponent(idGenerator(), entry, { pins: 4 }, chipBoard.center);
  expect(engine.execute('components.add', params)).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'invalid_footprint' }] },
  });
});

test.each([
  {
    board: { ...chipBoard, center: { x: Number.NEGATIVE_INFINITY, y: 0 } },
    path: ['board', 'center', 'x'],
  },
  { board: { ...chipBoard, rotationDeg: Number.NaN }, path: ['board', 'rotationDeg'] },
])('board placement rejects non-finite coordinates and angles %#', ({ board, path }) => {
  const { engine } = setup();
  expect(engine.execute('components.add', { ...add(), board })).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ path }] },
  });
});
