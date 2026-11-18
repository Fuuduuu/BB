import { expect, test } from 'vitest';
import type { BoardPlacement, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { alignByTwoPins } from './align';

const board: BoardPlacement = {
  footprint: 'soic',
  params: {},
  center: { x: 120, y: 80 },
  side: 'top',
  rotationDeg: 350,
  scaleX: 0.75,
  scaleY: 1.25,
  customPads: {},
};

const pxPerMm = 12.5;
const pinA = '1';
const pinB = '6';
const minTargetDistance = 5;
const selection = { board, pxPerMm, pinA, pinB, minTargetDistance };

function padAt(placement: BoardPlacement, pinId: string): Vec2 {
  return boardPads(placement, [pinId], pxPerMm)[0]!.at;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function verifyPose(start: BoardPlacement, expected: BoardPlacement) {
  const targetA = padAt(expected, pinA);
  const targetB = padAt(expected, pinB);
  const result = alignByTwoPins({ ...selection, board: start, targetA, targetB });
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(result.reason);

  const aligned = { ...start, ...result };
  expect(distance(aligned.center, expected.center)).toBeLessThan(0.01);
  expect(distance(padAt(aligned, pinA), targetA)).toBeLessThan(0.01);
  expect(distance(padAt(aligned, pinB), targetB)).toBeLessThan(0.01);
  const rotationError = Math.abs(((aligned.rotationDeg - expected.rotationDeg + 540) % 360) - 180);
  expect(rotationError).toBeLessThan(0.01);
  expect(aligned.scaleX).toBeCloseTo(expected.scaleX, 8);
  expect(aligned.scaleY).toBeCloseTo(expected.scaleY, 8);
}

test('align_by_two_pins_restores_known_pose_within_0_01px_and_0_01deg', () => {
  verifyPose(board, {
    ...board,
    center: { x: 201.35, y: 79.18 },
    rotationDeg: 37.5,
    scaleX: 1.2,
    scaleY: 2,
  });
});

test('align_handles_mirrored_bottom_side', () => {
  const mirrored = { ...board, side: 'bottom' } as const;
  verifyPose(mirrored, {
    ...mirrored,
    center: { x: 207.75, y: 131.18 },
    rotationDeg: 145,
    scaleX: 0.6,
    scaleY: 1,
  });
});

const targetA = { x: 30, y: 82 };
const targetB = { x: 95, y: 70 };
const args = { ...selection, targetA, targetB };

test('align_rejects_the_same_pin_twice', () => {
  expect(alignByTwoPins({ ...args, pinB: pinA })).toEqual({ ok: false, reason: 'same_pin' });
});

test('align_rejects_distinct_pins_at_the_same_board_position', () => {
  const pad = { local: { x: 1, y: 2 }, sizeMm: 1, shape: 'circle', through: false } as const;
  const customBoard = { ...board, customPads: { a: pad, b: pad } };
  expect(alignByTwoPins({ ...args, board: customBoard, pinA: 'a', pinB: 'b' })).toEqual({
    ok: false,
    reason: 'pins_coincide',
  });
});

test('align_rejects_a_pin_with_no_pad', () => {
  expect(alignByTwoPins({ ...args, pinA: 'missing' })).toEqual({
    ok: false,
    reason: 'pins_coincide',
  });
});

test('align_rejects_a_pin_mapped_to_multiple_pads', () => {
  const ambiguousBoard = { ...board, padMap: { '1': '1', '2': '1' } };
  expect(alignByTwoPins({ ...args, board: ambiguousBoard })).toEqual({
    ok: false,
    reason: 'pins_coincide',
  });
});

test('align_rejects_targets_closer_than_the_minimum_distance', () => {
  expect(alignByTwoPins({ ...args, targetB: { x: 34, y: 82 } })).toEqual({
    ok: false,
    reason: 'targets_coincide',
  });
});

test('align_accepts_the_minimum_target_distance_and_scale_boundaries', () => {
  const pad = { local: { x: 0, y: 0 }, sizeMm: 1, shape: 'circle', through: false } as const;
  const boundaryBoard = {
    ...board,
    center: pad.local,
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 5,
    customPads: { a: pad, b: { ...pad, local: { x: 0, y: 0.4 } } },
  };
  const result = alignByTwoPins({
    ...args,
    board: boundaryBoard,
    pinA: 'a',
    pinB: 'b',
    targetB: { x: 35, y: 82 },
  });
  expect(result).toEqual({
    ok: true,
    center: targetA,
    rotationDeg: 270,
    scaleX: 0.2,
    scaleY: 1,
  });
});

test('align_rejects_a_scale_outside_the_limits_on_either_axis', () => {
  const expected = { ...board, scaleX: 3.75, scaleY: 6.25 };
  expect(
    alignByTwoPins({ ...args, targetA: padAt(expected, pinA), targetB: padAt(expected, pinB) }),
  ).toEqual({ ok: false, reason: 'scale_out_of_range' });
});

test('align_accepts_a_scale_boundary_despite_coordinate_subtraction_roundoff', () => {
  const pad = { local: { x: -0.05, y: 0 }, sizeMm: 1, shape: 'circle', through: false } as const;
  const result = alignByTwoPins({
    ...args,
    board: {
      ...board,
      center: { x: 100, y: 80 },
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: { a: pad, b: { ...pad, local: { x: 0.05, y: 0 } } },
    },
    pxPerMm: 10,
    pinA: 'a',
    pinB: 'b',
    targetA: { x: 99.9, y: 80 },
    targetB: { x: 100.1, y: 80 },
    minTargetDistance: 5 / 32,
  });
  expect(result).toMatchObject({ ok: true, scaleX: 0.2, scaleY: 0.2 });
});
