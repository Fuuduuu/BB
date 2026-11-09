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
