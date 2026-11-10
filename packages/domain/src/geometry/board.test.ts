import { expect, test } from 'vitest';
import type { BoardPlacement, Vec2 } from '@pcbk/domain';
import { boardPads, bodyOutline, padToBoard } from '@pcbk/domain/geometry';

function placement(overrides: Partial<BoardPlacement> = {}): BoardPlacement {
  return {
    footprint: 'chip',
    params: {},
    center: { x: 100, y: 200 },
    rotationDeg: 0,
    side: 'top',
    scaleX: 1,
    scaleY: 1,
    customPads: {},
    ...overrides,
  };
}

function expectPoint(at: Vec2 | undefined, x: number, y: number) {
  expect(at?.x).toBeCloseTo(x, 10);
  expect(at?.y).toBeCloseTo(y, 10);
}

test('pad_to_board_applies_scale_mirror_rotation_in_order', () => {
  const local = Object.freeze({ x: 1, y: 2 });
  const top = Object.freeze(
    placement({ center: Object.freeze({ x: 100, y: 200 }), rotationDeg: 90, scaleX: 2, scaleY: 3 }),
  );
  const bottom = Object.freeze({ ...top, side: 'bottom' as const });

  expectPoint(padToBoard(top, local, 10), 40, 220);
  expectPoint(padToBoard(bottom, local, 10), 40, 180);
});

test('rotation_wraps_and_is_clockwise_with_y_down', () => {
  for (const rotationDeg of [90, 450, -270]) {
    const transform = placement({ center: { x: 0, y: 0 }, rotationDeg });
    expectPoint(padToBoard(transform, { x: 1, y: 0 }, 1), 0, 1);
  }
});

test('pad_map_redirects_pad_to_pin', () => {
  const board = Object.freeze(
    placement({
      scaleX: 2,
      padMap: Object.freeze({ '1': 'A', '2': 'missing', x1: 'A' }),
      customPads: Object.freeze({
        x1: Object.freeze({
          local: Object.freeze({ x: 0, y: 2 }),
          sizeMm: 2,
          shape: 'rect',
          through: false,
        }),
      }),
    }),
  );
  const pins = Object.freeze(['A', '2', 'x1']);

  expect(boardPads(board, pins, 12)).toStrictEqual([
    { pinId: 'A', at: { x: 76, y: 200 }, radiusPx: 12 },
    { pinId: 'x1', at: { x: 100, y: 224 }, radiusPx: 24 },
  ]);
});

test('body_outline_respects_scale', () => {
  const board = Object.freeze(placement({ scaleX: 2 }));
  expect(bodyOutline(board, 10)).toStrictEqual([
    { x: 80, y: 193.75 },
    { x: 120, y: 193.75 },
    { x: 120, y: 206.25 },
    { x: 80, y: 206.25 },
  ]);
});

test('area keeps its body outline without generating pads', () => {
  const board = placement({
    footprint: 'area',
    params: { w: 4, h: 2 },
    center: { x: 10, y: 20 },
    side: 'bottom',
    scaleX: 2,
    scaleY: 3,
    rotationDeg: 90,
  });
  expect(boardPads(board, ['1'], 1)).toEqual([]);
  const outline = bodyOutline(board, 1);
  expect(outline).toHaveLength(4);
  expectPoint(outline[0], 13, 24);
  expectPoint(outline[1], 13, 16);
  expectPoint(outline[2], 7, 16);
  expectPoint(outline[3], 7, 24);
});

test('invalid or unknown footprints keep manual pads for known pins', () => {
  for (const footprint of [
    { footprint: 'unknown' },
    { footprint: 'chip', params: { size: 'x' } },
  ]) {
    const board = placement({
      ...footprint,
      customPads: {
        A: { local: { x: 1, y: 2 }, sizeMm: 1, shape: 'circle', through: true },
        omitted: { local: { x: 5, y: 5 }, sizeMm: 2, shape: 'rect', through: false },
      },
    });
    expect(bodyOutline(board, 10)).toEqual([]);
    expect(boardPads(board, ['A'], 10)).toStrictEqual([
      { pinId: 'A', at: { x: 110, y: 220 }, radiusPx: 5 },
    ]);
  }
});

test('two physical pads mapped to one pin remain separate', () => {
  const board = placement({ padMap: { '1': 'A', '2': 'A' } });
  expect(boardPads(board, ['A'], 10)).toStrictEqual([
    { pinId: 'A', at: { x: 90, y: 200 }, radiusPx: 6.75 },
    { pinId: 'A', at: { x: 110, y: 200 }, radiusPx: 6.75 },
  ]);
});

test('manual pads follow pin order and ignore inherited entries', () => {
  const pad = { local: { x: 0, y: 0 }, sizeMm: 1, shape: 'circle', through: false } as const;
  const customPads = { second: pad, first: pad };
  Object.setPrototypeOf(customPads, { inherited: pad });
  const board = placement({ customPads });

  expect(
    boardPads(board, ['first', 'inherited', 'second', '1'], 10).map(({ pinId }) => pinId),
  ).toEqual(['1', 'first', 'second']);
});
