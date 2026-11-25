import { assert, expect, test } from 'vitest';
import { newBoardDoc } from '../doc';
import { boardPads } from '../geometry/board';
import type { BoardPlacement, Component } from '../model/component';
import { pinSpacingMm, RuleTargetNotFound, scaleFromPins } from './index';

test('scale_from_pins_sets_scale_and_places_component', () => {
  const board: BoardPlacement = {
    footprint: 'chip',
    params: { size: '0805' },
    center: { x: 100, y: 80 },
    rotationDeg: 0,
    side: 'top',
    scaleX: 0.3,
    scaleY: 0.4,
    customPads: {},
  };
  const component: Component = {
    id: 'cmp_r1',
    ref: 'R1',
    kind: 'resistor',
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: [
      { id: '1', uid: 'pin_a', nc: false },
      { id: '2', uid: 'pin_b', nc: false },
    ],
    board,
  };
  const doc = newBoardDoc('Sünteetiline mõõtkava katse');
  doc.components.push(component);
  const other = structuredClone(component);
  other.id = 'cmp_r2';
  other.ref = 'R2';
  other.pins = [
    { id: '1', uid: 'pin_c', nc: false },
    { id: '2', uid: 'pin_d', nc: false },
  ];
  doc.components.push(other);
  const initial = structuredClone(doc);
  const [initialComponent] = initial.components;
  assert(initialComponent);
  const input = {
    componentId: component.id,
    pinA: { id: '1', padIndex: 0 },
    pinB: { id: '2', padIndex: 0 },
    targetA: { x: 200, y: 200 },
    targetB: { x: 200, y: 240 },
  };

  expect(pinSpacingMm(board, input.pinA, input.pinB)).toBe(2);
  scaleFromPins(doc, input);
  expect(doc.scale).toEqual({
    pxPerMm: 20,
    calibrated: true,
    calib: { a: input.targetA, b: input.targetB, mm: 2 },
  });
  expect(component.board).toMatchObject({
    scaleX: 1,
    scaleY: 1,
    center: { x: 200, y: 220 },
    rotationDeg: 90,
  });
  expect(doc.components[1]).toEqual(initial.components[1]);

  function expectTargets(placement: BoardPlacement) {
    const [first, second] = boardPads(placement, ['1', '2'], 20);
    assert(first && second);
    expect(first.at.x).toBeCloseTo(input.targetA.x);
    expect(first.at.y).toBeCloseTo(input.targetA.y);
    expect(second.at.x).toBeCloseTo(input.targetB.x);
    expect(second.at.y).toBeCloseTo(input.targetB.y);
  }

  expectTargets(component.board!);
  const bottom = structuredClone(initial);
  const bottomBoard = bottom.components[0]?.board;
  assert(bottomBoard);
  bottomBoard.side = 'bottom';
  scaleFromPins(bottom, input);
  expectTargets(bottomBoard);

  const rotated = structuredClone(initial);
  const rotatedBoard = rotated.components[0]?.board;
  assert(rotatedBoard);
  rotatedBoard.rotationDeg = 4;
  scaleFromPins(rotated, { ...input, targetB: { x: 200, y: 2200 } });
  expect(rotated.scale.pxPerMm).toBe(1000);

  const unplaced = structuredClone(initialComponent);
  unplaced.id = 'cmp_unplaced';
  delete unplaced.board;
  initial.components.push(unplaced);
  const beforeRejected = structuredClone(initial);
  const rejectedInputs = [
    [{ ...input, pinB: input.pinA }, 'pins_coincide'],
    [{ ...input, pinB: { ...input.pinB, padIndex: 1 } }, 'pins_coincide'],
    [{ ...input, targetB: { x: 200, y: 204 } }, 'scale_from_pins_out_of_range'],
    [{ ...input, targetB: { x: 200, y: 3200 } }, 'scale_from_pins_out_of_range'],
    [{ ...input, componentId: unplaced.id }, 'not_placed'],
  ] as const;
  for (const [rejectedInput, error] of rejectedInputs) {
    expect(() => scaleFromPins(initial, rejectedInput)).toThrow(error);
    expect(initial).toEqual(beforeRejected);
  }
  expect(() => scaleFromPins(initial, { ...input, componentId: 'missing' })).toThrow(
    RuleTargetNotFound,
  );
  expect(initial).toEqual(beforeRejected);
});
