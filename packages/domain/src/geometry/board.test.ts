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

test('board_pads_return_pad_size_angle_and_shape', () => {
  const board = placement({
    center: { x: 0, y: 0 },
    side: 'bottom',
    rotationDeg: 90,
    scaleX: 3,
    scaleY: 2,
    customPads: {
      manual: { local: { x: 2, y: 1 }, sizeMm: 2, shape: 'rect', through: false },
    },
  });
  const pads = boardPads(board, ['1', 'manual'], 20);

  expect(pads).toHaveLength(2);
  expect(pads[0]).toMatchObject({
    pinId: '1',
    halfPx: { x: 30, y: 27 },
    angleDeg: 90,
    shape: 'rect',
    radiusPx: 30,
  });
  expectPoint(pads[0]?.at, 0, 60);
  expect(pads[1]).toStrictEqual({
    pinId: 'manual',
    at: { x: expect.closeTo(-40, 10), y: expect.closeTo(-120, 10) },
    halfPx: { x: 60, y: 40 },
    angleDeg: 90,
    shape: 'circle',
    radiusPx: 60,
  });
});

test('board_pads_keep_round_footprint_pad_shape', () => {
  const pads = boardPads(
    placement({ footprint: 'header1', params: { pins: 4, pitch: 2.54 } }),
    ['1', '2'],
    10,
  );

  expect(pads.map(({ pinId, shape }) => ({ pinId, shape }))).toEqual([
    { pinId: '1', shape: 'rect' },
    { pinId: '2', shape: 'circle' },
  ]);
});

test.each([
  ['top', 0, 40, 200],
  ['top', 90, 100, 140],
  ['top', 180, 160, 200],
  ['top', 270, 100, 260],
  ['bottom', 0, 160, 200],
  ['bottom', 90, 100, 260],
  ['bottom', 180, 40, 200],
  ['bottom', 270, 100, 140],
  ['bottom', 450, 100, 260],
  ['bottom', -270, 100, 260],
] as const)('pad_axes_follow_placement_%s_%s', (side, rotationDeg, x, y) => {
  const board = placement({ side, rotationDeg, scaleX: 3, scaleY: 2 });
  const pads = boardPads(board, ['1'], 20);

  expect(pads).toHaveLength(1);
  expect(pads[0]).toMatchObject({
    halfPx: { x: 30, y: 27 },
    angleDeg: rotationDeg,
    shape: 'rect',
    radiusPx: 30,
  });
  expectPoint(pads[0]?.at, x, y);
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
    {
      pinId: 'A',
      at: { x: 76, y: 200 },
      radiusPx: 12,
      halfPx: { x: 12, y: expect.closeTo(8.1, 10) },
      angleDeg: 0,
      shape: 'rect',
    },
    {
      pinId: 'x1',
      at: { x: 100, y: 224 },
      radiusPx: 24,
      halfPx: { x: 24, y: 12 },
      angleDeg: 0,
      shape: 'circle',
    },
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
      {
        pinId: 'A',
        at: { x: 110, y: 220 },
        radiusPx: 5,
        halfPx: { x: 5, y: 5 },
        angleDeg: 0,
        shape: 'circle',
      },
    ]);
  }
});

test('two physical pads mapped to one pin remain separate', () => {
  const board = placement({ padMap: { '1': 'A', '2': 'A' } });
  expect(boardPads(board, ['A'], 10)).toStrictEqual([
    {
      pinId: 'A',
      at: { x: 90, y: 200 },
      radiusPx: 6.75,
      halfPx: { x: 5, y: 6.75 },
      angleDeg: 0,
      shape: 'rect',
    },
    {
      pinId: 'A',
      at: { x: 110, y: 200 },
      radiusPx: 6.75,
      halfPx: { x: 5, y: 6.75 },
      angleDeg: 0,
      shape: 'rect',
    },
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
