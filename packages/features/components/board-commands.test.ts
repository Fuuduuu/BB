import { newBoardDoc } from '@pcbk/domain';
import type { AddComponentParams } from './contract';
import { expect, test } from 'vitest';
import { setup } from '../__tests__/helpers';

const add = (id = 'cmp_a', ref?: string): AddComponentParams => ({
  id,
  kind: 'resistor',
  ref,
  pins: [
    { id: '1', uid: `pin_${id}_1` },
    { id: '2', uid: `pin_${id}_2` },
  ],
});

const chipBoard = { footprint: 'chip', center: { x: 20, y: 35 } };

test('place_on_board_matches_ids_after_m0_pin_reorder', () => {
  const { engine } = setup();
  expect(engine.execute('components.add', { ...add(), pins: add().pins.reverse() }).ok).toBe(true);
  const before = engine.snapshot().doc.components[0];
  const board = { ...chipBoard, rotationDeg: -450, side: 'bottom' } as const;
  expect(engine.execute('components.placeOnBoard', { id: 'cmp_a', board }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]).toEqual({
    ...before,
    board: {
      ...board,
      rotationDeg: 270,
      params: { size: '0805' },
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    },
  });
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]).toEqual(before);
});

test('place_on_board_rejects_already_placed', () => {
  const { engine } = setup();
  engine.execute('components.add', { ...add(), board: chipBoard });
  const before = engine.snapshot();
  expect(
    engine.execute('components.placeOnBoard', { id: 'cmp_a', board: chipBoard }),
  ).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'already_placed' }] },
  });
  expect(engine.snapshot()).toBe(before);
});

test('placeOnBoard rejects a legacy pin set that does not match the footprint', () => {
  const { engine } = setup();
  const pins = [
    { id: '1', uid: 'pin_1' },
    { id: 'VCC', uid: 'pin_vcc' },
  ];
  engine.execute('components.add', { ...add(), pins });
  const before = engine.snapshot();
  expect(
    engine.execute('components.placeOnBoard', { id: 'cmp_a', board: chipBoard }),
  ).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'footprint_pins_mismatch' }] },
  });
  expect(engine.snapshot()).toBe(before);
});

test('remove_from_board_keeps_component_and_pins', () => {
  const doc = newBoardDoc('Plaat');
  doc.measurements.push({
    id: 'msr_a',
    mode: 'voltage',
    at: { c: 'cmp_a', p: '1', uid: 'pin_cmp_a_1' },
    atLabel: 'R1:1',
    value: 2.5,
    power: 'on',
    takenAt: '2026-11-08T10:00:00.000Z',
    source: 'manual',
  });
  const { engine } = setup(doc);
  expect(engine.execute('components.add', { ...add(), board: chipBoard }).ok).toBe(true);
  const { board, ...unplaced } = engine.snapshot().doc.components[0]!;
  expect(engine.execute('components.removeFromBoard', { id: 'cmp_a' }).ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual([unplaced]);
  expect(engine.snapshot().doc.measurements).toEqual(doc.measurements);
  const after = engine.snapshot();
  expect(engine.execute('components.removeFromBoard', { id: 'cmp_a' })).toEqual({
    ok: true,
    value: { rev: after.doc.rev },
  });
  expect(engine.snapshot()).toBe(after);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual([{ ...unplaced, board }]);
});

test('area_replaces_board_placement_preserving_manual_pins', () => {
  const { engine } = setup();
  const pins = [
    { id: 'A', uid: 'pin_a' },
    { id: 'VCC', uid: 'pin_vcc' },
  ];
  const board = { ...chipBoard, footprint: 'area' };
  expect(engine.execute('components.add', { ...add(), kind: 'other', pins, board }).ok).toBe(true);
  expect(engine.execute('components.removeFromBoard', { id: 'cmp_a' }).ok).toBe(true);
  const replacement = { ...board, params: { w: 15 } };
  expect(engine.execute('components.placeOnBoard', { id: 'cmp_a', board: replacement }).ok).toBe(
    true,
  );
  expect(engine.snapshot().doc.components[0]).toMatchObject({
    pins: [
      { id: 'A', uid: 'pin_a' },
      { id: 'VCC', uid: 'pin_vcc' },
    ],
    board: { ...replacement, params: { w: 15, h: 10 }, customPads: {} },
  });
});

test('rotate_normalizes_to_0_360', () => {
  const { engine } = setup();
  engine.execute('components.add', { ...add(), board: { ...chipBoard, rotationDeg: 350 } });
  expect(engine.execute('components.rotate', { id: 'cmp_a', deltaDeg: 25 }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board?.rotationDeg).toBe(15);
  expect(engine.execute('components.rotate', { id: 'cmp_a', deltaDeg: -400 }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board?.rotationDeg).toBe(335);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board?.rotationDeg).toBe(15);
});

test('rotate preserves an in-range fractional angle', () => {
  const { engine } = setup();
  engine.execute('components.add', { ...add(), board: { ...chipBoard, rotationDeg: 0.1 } });
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(0.1);
  expect(engine.execute('components.rotate', { id: 'cmp_a', deltaDeg: -0.05 }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board?.rotationDeg).toBe(0.05);
});

test('flip_side_toggles_top_bottom', () => {
  const { engine } = setup();
  engine.execute('components.add', { ...add(), board: chipBoard });
  const original = engine.snapshot().doc.components[0];
  expect(engine.execute('components.flipSide', { id: 'cmp_a' }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board?.side).toBe('bottom');
  expect(engine.execute('components.flipSide', { id: 'cmp_a' }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]).toEqual(original);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board?.side).toBe('bottom');
});

test('setLabelOffset stores an offset and null removes it', () => {
  const { engine } = setup();
  engine.execute('components.add', { ...add(), board: chipBoard });
  const offset = { x: -4, y: 8 };
  expect(engine.execute('components.setLabelOffset', { id: 'cmp_a', offset }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board?.labelOffset).toEqual(offset);
  expect(engine.execute('components.setLabelOffset', { id: 'cmp_a', offset: null }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board).not.toHaveProperty('labelOffset');
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board?.labelOffset).toEqual(offset);
});

test('board commands reject non-finite rotation and label offset', () => {
  const { engine } = setup();
  engine.execute('components.add', { ...add(), board: chipBoard });
  const id = 'cmp_a';
  const before = engine.snapshot();
  const expected = { ok: false, error: { code: 'validation' } };
  expect(
    engine.execute('components.rotate', { id, deltaDeg: Number.POSITIVE_INFINITY }),
  ).toMatchObject(expected);
  expect(
    engine.execute('components.setLabelOffset', { id, offset: { x: 1, y: Number.NaN } }),
  ).toMatchObject(expected);
  expect(engine.snapshot()).toBe(before);
});

test('commands_on_unplaced_component_return_component_not_placed', () => {
  const { engine } = setup();
  engine.execute('components.add', add());
  const id = 'cmp_a';
  const before = engine.snapshot();
  const expected = {
    ok: false,
    error: { code: 'validation', issues: [{ message: 'component_not_placed' }] },
  };
  expect(engine.execute('components.rotate', { id, deltaDeg: 45 })).toMatchObject(expected);
  expect(engine.execute('components.flipSide', { id })).toMatchObject(expected);
  expect(engine.execute('components.setLabelOffset', { id, offset: null })).toMatchObject(expected);
  expect(engine.snapshot()).toBe(before);
});

test('board commands return not_found for a missing component', () => {
  const { engine } = setup();
  const id = 'cmp_missing';
  const expected = { ok: false, error: { code: 'not_found', id } };
  expect(engine.execute('components.placeOnBoard', { id, board: chipBoard })).toEqual(expected);
  expect(engine.execute('components.removeFromBoard', { id })).toEqual(expected);
  expect(engine.execute('components.rotate', { id, deltaDeg: 45 })).toEqual(expected);
  expect(engine.execute('components.flipSide', { id })).toEqual(expected);
  expect(engine.execute('components.setLabelOffset', { id, offset: null })).toEqual(expected);
});

test('derived_unplaced_board_updates', () => {
  const { engine } = setup();
  engine.execute('components.add', add());
  expect(engine.snapshot().derived.unplacedBoard).toEqual(['cmp_a']);
  expect(engine.execute('components.placeOnBoard', { id: 'cmp_a', board: chipBoard }).ok).toBe(
    true,
  );
  expect(engine.snapshot().derived.unplacedBoard).toEqual([]);
  expect(engine.snapshot().derived.unplacedSchematic).toEqual(['cmp_a']);
  expect(engine.execute('components.removeFromBoard', { id: 'cmp_a' }).ok).toBe(true);
  expect(engine.snapshot().derived.unplacedBoard).toEqual(['cmp_a']);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().derived.unplacedBoard).toEqual([]);
});
