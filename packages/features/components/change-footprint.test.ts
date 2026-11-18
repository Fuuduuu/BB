import { boardPads, newBoardDoc } from '@pcbk/domain';
import type { BoardDoc } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../engine';
import { COMPONENT_LIBRARY, makePlacedComponent } from './contract';
import { idGenerator } from '../__tests__/helpers';

function setup(doc: BoardDoc = newBoardDoc('Plaat')) {
  const result = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-15T10:00:00.000Z' },
  });
  result.host.load('footprint-test', doc, false);
  return result;
}

function placed(count = 8) {
  const result = setup();
  expect(
    result.engine.execute('components.add', {
      id: 'cmp_a',
      kind: 'ic',
      pins: Array.from({ length: count }, (_, index) => ({
        id: String(index + 1),
        uid: `pin_original_${index + 1}`,
      })),
      board: { footprint: 'soic', params: { pins: count }, center: { x: 20, y: 35 } },
    }),
  ).toMatchObject({ ok: true });
  return result;
}

const swap = (pins: number, generation = 'new') => ({
  id: 'cmp_a',
  footprint: 'soic',
  params: { pins },
  newPinUids: Object.fromEntries(
    Array.from({ length: pins }, (_, index) => [
      String(index + 1),
      `pin_${generation}_${index + 1}`,
    ]),
  ),
});

function addMeasurement(engine: ReturnType<typeof setup>['engine'], pin: number, ref?: number) {
  const contact = (id: number) => ({ c: 'cmp_a', p: String(id), uid: `pin_original_${id}` });
  expect(
    engine.execute('measurements.add', {
      id: `msr_${pin}`,
      mode: 'voltage',
      at: contact(pin),
      ...(ref === undefined ? {} : { ref: contact(ref) }),
      value: 3.3,
      power: 'on',
      takenAt: '2026-11-15T10:00:00.000Z',
    }).ok,
  ).toBe(true);
}

test('soic8_to_soic14_keeps_pins_1_to_8_uid', () => {
  const { engine, host } = placed();
  engine.execute('components.renamePin', { id: 'cmp_a', pinId: '3', name: 'VCC' });
  engine.execute('components.setNc', { id: 'cmp_a', pinId: '4', nc: true });
  addMeasurement(engine, 3);
  const before = engine.snapshot();
  host.drainJournal();
  expect(engine.execute('components.changeFootprint', swap(14)).ok).toBe(true);
  const after = engine.snapshot();
  expect(after.doc.components[0]!.pins.slice(0, 8)).toEqual(before.doc.components[0]!.pins);
  expect(after.doc.components[0]!.pins.map(({ id }) => id)).toEqual(
    Array.from({ length: 14 }, (_, index) => String(index + 1)),
  );
  expect(after.doc.components[0]!.pins[8]).toEqual({ id: '9', uid: 'pin_new_9', nc: false });
  expect(after.doc.components[0]!.board?.params).toEqual({ pins: 14, body: 3.9 });
  expect(after.doc.measurements).toEqual(before.doc.measurements);
  expect(after.derived.pinReadings.pin_original_3?.measurementId).toBe('msr_3');
  expect(after.rev).toBe(before.rev + 1);
  expect(host.drainJournal()).toMatchObject([{ commandId: 'components.changeFootprint' }]);
});

test('growing_back_does_not_reactivate_old_measurements', () => {
  const { engine } = placed(14);
  addMeasurement(engine, 3);
  addMeasurement(engine, 12);
  addMeasurement(engine, 5, 12);
  const measurements = engine.snapshot().doc.measurements;
  expect(engine.execute('components.changeFootprint', swap(8)).ok).toBe(true);
  expect(engine.snapshot().derived.pinReadings.pin_original_3?.measurementId).toBe('msr_3');
  expect(engine.snapshot().derived.pinReadings).not.toHaveProperty('pin_original_12');
  expect(engine.snapshot().derived.pinReadings).not.toHaveProperty('pin_original_5');
  expect(engine.execute('components.changeFootprint', swap(14, 'regrown')).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.pins[11]?.uid).toBe('pin_regrown_12');
  expect(engine.snapshot().doc.measurements).toEqual(measurements);
  expect(engine.snapshot().derived.pinReadings).not.toHaveProperty('pin_original_12');
  expect(engine.snapshot().derived.pinReadings).not.toHaveProperty('pin_regrown_12');
});

test('undo_restores_same_uid_and_active_measurements', () => {
  const { engine } = placed(14);
  addMeasurement(engine, 12);
  const before = engine.snapshot();
  expect(engine.execute('components.changeFootprint', swap(8)).ok).toBe(true);
  expect(engine.snapshot().derived.pinReadings).not.toHaveProperty('pin_original_12');
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(before.doc.components);
  expect(engine.snapshot().derived.pinReadings.pin_original_12?.measurementId).toBe('msr_12');
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.pins).toHaveLength(8);
  expect(engine.snapshot().derived.pinReadings).not.toHaveProperty('pin_original_12');
});

test('change_footprint_keeps_center_rotation_side_and_label_offset', () => {
  const initial = placed();
  const doc = structuredClone(initial.engine.snapshot().doc) as BoardDoc;
  const board = doc.components[0]!.board!;
  Object.assign(board, {
    rotationDeg: 27.5,
    side: 'bottom',
    labelOffset: { x: -4, y: 9 },
    scaleX: 1.2,
    scaleY: 0.8,
  });
  const { engine } = setup(doc);
  const before = engine.snapshot().doc.components[0]!;
  expect(engine.execute('components.changeFootprint', swap(14)).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]).toEqual({
    ...before,
    pins: expect.any(Array),
    board: { ...before.board, params: { pins: 14, body: 3.9 } },
  });
});

test('refreshing a footprint preserves valid pad permutations and pin identities', () => {
  const initial = placed();
  const doc = structuredClone(initial.engine.snapshot().doc) as BoardDoc;
  const padMap = { '1': '2', '2': '1', '3': '4', '4': '3' };
  doc.components[0]!.board!.padMap = padMap;
  const { engine } = setup(doc);
  addMeasurement(engine, 2);
  const before = engine.snapshot();

  expect(
    engine.execute('components.changeFootprint', {
      ...swap(8),
      params: { pins: 8, body: 7.5 },
    }).ok,
  ).toBe(true);

  const after = engine.snapshot();
  const { board, pins } = after.doc.components[0]!;
  expect(board?.padMap).toEqual(padMap);
  expect(pins).toEqual(before.doc.components[0]!.pins);
  expect(after.derived.pinReadings.pin_original_2?.measurementId).toBe('msr_2');
  expect(
    boardPads(
      board!,
      pins.map(({ id }) => id),
      1,
    ).map((pad) => pad.pinId),
  ).toEqual(['2', '1', '4', '3', '5', '6', '7', '8']);
});

test('a smaller footprint keeps complete pad permutations and noncolliding custom pads', () => {
  const initial = placed(14);
  const doc = structuredClone(initial.engine.snapshot().doc) as BoardDoc;
  const customPad = {
    local: { x: 1, y: 2 },
    sizeMm: 1,
    shape: 'circle' as const,
    through: false,
  };
  Object.assign(doc.components[0]!.board!, {
    customPads: { '3': customPad, '12': customPad, stale: customPad },
    padMap: {
      '1': '2',
      '2': '1',
      '3': '12',
      '4': '1',
      '5': '6',
      '7': '7',
      '12': '3',
      alias: '3',
    },
  });
  const { engine } = setup(doc);
  const before = engine.snapshot().doc.components;
  expect(engine.execute('components.changeFootprint', swap(8)).ok).toBe(true);
  const { board, pins } = engine.snapshot().doc.components[0]!;
  expect(board?.customPads).toEqual({ '12': customPad });
  expect(board?.padMap).toEqual({ '1': '2', '2': '1', '7': '7' });
  expect(pins.map(({ id }) => id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '12']);
  expect(
    boardPads(
      board!,
      pins.map(({ id }) => id),
      1,
    ).map((pad) => pad.pinId),
  ).toEqual(['2', '1', '3', '4', '5', '6', '7', '8', '12']);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(before);
});

test('change_footprint_rejects_unplaced_and_missing_uid', () => {
  const { engine } = placed();
  const before = engine.snapshot();
  const rejection = (message: string) => ({
    ok: false,
    error: { code: 'validation', issues: [{ message }] },
  });
  expect(
    engine.execute('components.changeFootprint', { ...swap(14), newPinUids: {} }),
  ).toMatchObject(rejection('missing_pin_uid'));
  expect(engine.snapshot()).toBe(before);
  expect(engine.execute('components.removeFromBoard', { id: 'cmp_a' }).ok).toBe(true);
  const unplaced = engine.snapshot();
  expect(engine.execute('components.changeFootprint', swap(14))).toMatchObject(
    rejection('component_not_placed'),
  );
  expect(engine.snapshot()).toBe(unplaced);
  expect(engine.execute('components.changeFootprint', { ...swap(14), id: 'cmp_missing' })).toEqual({
    ok: false,
    error: { code: 'not_found', id: 'cmp_missing' },
  });
});

test('pad_names_set_on_add_and_for_new_pins_only', () => {
  const { engine } = setup();
  const entry = COMPONENT_LIBRARY.find(({ id }) => id === 'dcjack')!;
  const params = makePlacedComponent(idGenerator(), entry, {}, { x: 5, y: 6 });
  expect(params.pins.map(({ name }) => name)).toEqual(['+', '−', 'SW']);
  expect(engine.execute('components.add', params).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.pins.map(({ name }) => name)).toEqual([
    '+',
    '−',
    'SW',
  ]);
  const custom = placed();
  custom.engine.execute('components.renamePin', { id: 'cmp_a', pinId: '2', name: 'User name' });
  custom.engine.execute('components.setNc', { id: 'cmp_a', pinId: '2', nc: true });
  expect(
    custom.engine.execute('components.changeFootprint', {
      id: 'cmp_a',
      footprint: entry.footprint,
      params: {},
      newPinUids: {},
    }).ok,
  ).toBe(true);
  expect(custom.engine.snapshot().doc.components[0]!.pins).toEqual([
    { id: '1', uid: 'pin_original_1', nc: false },
    { id: '2', uid: 'pin_original_2', name: 'User name', nc: true },
    { id: '3', uid: 'pin_original_3', nc: false },
  ]);
  const legacy = structuredClone(custom.engine.snapshot().doc) as BoardDoc;
  legacy.components[0]!.pins.pop();
  custom.host.load('legacy-missing-pin', legacy, false);
  expect(
    custom.engine.execute('components.changeFootprint', {
      id: 'cmp_a',
      footprint: entry.footprint,
      params: {},
      newPinUids: { '3': 'pin_new_switch' },
    }).ok,
  ).toBe(true);
  expect(custom.engine.snapshot().doc.components[0]!.pins[2]).toEqual({
    id: '3',
    uid: 'pin_new_switch',
    nc: false,
    name: 'SW',
  });
});

test('area_to_package_matches_legacy_pin_ids_and_uses_target_order', () => {
  const { engine } = setup();
  expect(
    engine.execute('components.add', {
      id: 'cmp_a',
      kind: 'other',
      pins: [
        { id: '2', uid: 'pin_two', name: 'second' },
        { id: '1', uid: 'pin_one' },
        { id: 'legacy', uid: 'pin_legacy' },
      ],
      board: { footprint: 'area', center: { x: 0, y: 0 } },
    }).ok,
  ).toBe(true);
  expect(
    engine.execute('components.changeFootprint', {
      id: 'cmp_a',
      footprint: 'chip',
      params: {},
      newPinUids: {},
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.components[0]!.pins).toEqual([
    { id: '1', uid: 'pin_one', nc: false },
    { id: '2', uid: 'pin_two', nc: false, name: 'second' },
  ]);
  expect(engine.snapshot().doc.components[0]!.kind).toBe('other');
});

test.each([
  { footprint: 'missing' },
  { params: { pins: 9 } },
  { params: { pins: 14, extra: 1 } },
  { params: { pins: Infinity } },
  { params: [] },
])('changeFootprint rejects invalid geometry atomically %#', (invalid) => {
  const { engine, host } = placed();
  const before = engine.snapshot();
  host.drainJournal();
  expect(
    engine.execute('components.changeFootprint', { ...swap(14), ...invalid } as never),
  ).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'invalid_footprint' }] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test.each(['', 'wrong', 'pin_', 'pin_original_1'])(
  'changeFootprint rejects malformed or reused uid %s',
  (uid) => {
    const { engine, host } = placed();
    const before = engine.snapshot();
    host.drainJournal();
    const params = swap(14);
    params.newPinUids['9'] = uid;
    expect(engine.execute('components.changeFootprint', params)).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    });
    expect(engine.snapshot()).toBe(before);
    expect(host.drainJournal()).toEqual([]);
  },
);

test('changeFootprint preserves read_only and stale_session behavior', () => {
  const initial = placed();
  const doc = structuredClone(initial.engine.snapshot().doc) as BoardDoc;
  const { engine, host } = setup(doc);
  host.load('read-only-footprint-test', doc, true);
  const before = engine.snapshot();
  expect(engine.execute('components.changeFootprint', swap(14))).toEqual({
    ok: false,
    error: { code: 'read_only' },
  });
  expect(engine.snapshot()).toBe(before);
  host.unload();
  expect(engine.execute('components.changeFootprint', swap(14))).toEqual({
    ok: false,
    error: { code: 'stale_session' },
  });
});
