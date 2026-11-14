import { describe, expect, it } from 'vitest';
import { createHitIndex, type HitItem } from './hit-index';

function pin(id: string, x: number, y: number, r = 1): HitItem {
  return { kind: 'pin', id, shape: { type: 'point', at: { x, y }, r } };
}

function pad(
  id: string,
  at: { x: number; y: number },
  half = { x: 10, y: 2 },
  angleDeg = 0,
): HitItem {
  return { kind: 'pin', id, shape: { type: 'rect', at, half, angleDeg }, priority: 2 };
}

it('rect_hit_accepts_inside_rotated_pad_and_rejects_outside', () => {
  const target = pad('rotated', { x: 20, y: 30 }, { x: 10, y: 2 }, 45);
  const hits = createHitIndex([target]);
  expect(hits.query({ x: 26, y: 36 }, 2)).toBe(target);
  expect(hits.query({ x: 20, y: 34 }, 2)).toBeUndefined();
  expect(hits.query({ x: 28, y: 38 }, 2)).toBeUndefined();
});

it('rect_hit_grows_to_min_5_screen_px', () => {
  const target = pad('tiny', { x: 30, y: 30 }, { x: 0.1, y: 0.2 });
  const otherCells = Array.from({ length: 12 }, (_, i) => pin(`other-${i}`, 300 + 32 * i, 300));
  const hits = createHitIndex([target, ...otherCells], 16);
  for (const zoom of [0.5, 1, 2]) {
    const half = 2.5 / zoom;
    expect(hits.query({ x: 30 + half, y: 30 + half }, zoom)).toBe(target);
    expect(hits.query({ x: 30 + half + 0.01, y: 30 }, zoom)).toBeUndefined();
    expect(hits.query({ x: 30, y: 30 - half - 0.01 }, zoom)).toBeUndefined();
  }
  const long = pad('long', { x: 0, y: 0 }, { x: 10, y: 1 });
  expect(createHitIndex([long]).query({ x: 10, y: 2.5 }, 1)).toBe(long);
  expect(createHitIndex([long]).query({ x: 10.01, y: 0 }, 1)).toBeUndefined();
});

it('rotated_rect_includes_its_boundary_corners', () => {
  for (const [angle, edge, outside] of [
    [0, { x: 30, y: 32 }, { x: 30.01, y: 32 }],
    [90, { x: 18, y: 40 }, { x: 18, y: 40.01 }],
    [180, { x: 10, y: 28 }, { x: 9.99, y: 28 }],
    [270, { x: 22, y: 20 }, { x: 22, y: 19.99 }],
  ] as const) {
    const target = pad('edge', { x: 20, y: 30 }, { x: 10, y: 2 }, angle);
    const hits = createHitIndex([target]);
    expect(hits.query(edge, 2)).toBe(target);
    expect(hits.query(outside, 2)).toBeUndefined();
  }
});

it('rect_boundary_includes_translation_rounding_at_normal_board_coordinates', () => {
  const target = pad('translated', { x: 1000, y: 800 }, { x: 7.75, y: 3 }, 45);
  const hits = createHitIndex([target]);
  // Rotate local corner (7.75,3) by45 degrees, then translate by(1000,800).
  expect(hits.query({ x: 1003.3587572106361, y: 807.6013978977554 }, 1)).toBe(target);
  expect(hits.query({ x: 1003.3587572106361, y: 807.6023978977554 }, 1)).toBeUndefined();
});

it('pin_hit_picks_nearest_center_between_neighbours', () => {
  const first = pad('first', { x: -3, y: 0 }, { x: 3, y: 0.3 });
  const second = pad('second', { x: 3, y: 0 }, { x: 3, y: 0.3 });
  const hits = createHitIndex([first, second]);
  expect(hits.query({ x: 1, y: 0 }, 0.5)).toBe(second);
  expect(hits.query({ x: -1, y: 0 }, 0.5)).toBe(first);
  expect(createHitIndex([second, first]).query({ x: 1, y: 0 }, 0.5)).toBe(second);
  const point = { ...pin('point', 0, 0), priority: 2 };
  expect(createHitIndex([second, point]).query({ x: 0.5, y: 0 }, 0.5)).toBe(point);
  expect(createHitIndex([{ ...point, priority: 1 }, second]).query({ x: 0.5, y: 0 }, 0.5)).toBe(
    second,
  );
});

it('rotated_rect_corners_are_indexed_across_grid_cells', () => {
  const target = pad('large', { x: 0, y: 0 }, { x: 30, y: 40 }, 45);
  const otherCells = Array.from({ length: 24 }, (_, i) => pin(`other-${i}`, 300 + 32 * i, 300));
  const hits = createHitIndex([target, ...otherCells], 16);
  // Inverse rotation gives (41 / sqrt(2), 55 / sqrt(2)), inside (30, 40).
  expect(hits.query({ x: -7, y: 48 }, 2)).toBe(target);
  expect(hits.query({ x: -7, y: 52 }, 2)).toBeUndefined();
});

describe('hit index', () => {
  it('nearest_pin_wins_inside_hit_radius', () => {
    const farther = pin('farther', -38, 5, 16);
    const nearer = pin('nearer', -30, 5);
    const hits = createHitIndex([farther, nearer]);

    expect(hits.query({ x: -32, y: 5 }, 1)).toBe(nearer);
  });

  it('applies the 6 screen-pixel minimum on both sides of a grid boundary', () => {
    const target = pin('target', 30, 0);
    const otherCells = Array.from({ length: 8 }, (_, i) => pin(`other-${i}`, 300 + 32 * i, 300));
    const hits = createHitIndex([target, ...otherCells], 16);

    expect(hits.query({ x: 42, y: 0 }, 0.5)).toBe(target);
    expect(hits.query({ x: 42.01, y: 0 }, 0.5)).toBeUndefined();
    expect(hits.query({ x: 33, y: 0 }, 2)).toBe(target);
    expect(hits.query({ x: 33.01, y: 0 }, 2)).toBeUndefined();
  });

  it('uses priority before geometric distance only for eligible shapes', () => {
    const nearer = pin('nearer', 0, 0);
    const preferred = { ...pin('preferred', 5, 0), priority: 1 };
    const outOfRange = { ...pin('out-of-range', 7, 0), priority: 2 };
    const hits = createHitIndex([nearer, preferred, outOfRange]);

    expect(hits.query({ x: 0, y: 0 }, 1)).toBe(preferred);
  });

  it('hit_index_supports_point_segment_and_area', () => {
    const point = pin('point', -30, 0, 10);
    const segment: HitItem = {
      kind: 'trace',
      id: 'segment',
      shape: { type: 'segment', a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, width: 16 },
    };
    const area: HitItem = {
      kind: 'region',
      id: 'area',
      shape: {
        type: 'area',
        polygon: [
          { x: 0, y: 20 },
          { x: 80, y: 20 },
          { x: 80, y: 40 },
          { x: 20, y: 40 },
          { x: 20, y: 100 },
          { x: 0, y: 100 },
        ],
      },
    };
    const hits = createHitIndex([point, segment, area]);

    expect(hits.query({ x: -39, y: 0 }, 4)).toBe(point);
    expect(hits.query({ x: 35, y: 7 }, 4)).toBe(segment);
    expect(hits.query({ x: 56, y: -6 }, 4)).toBeUndefined();
    expect(hits.query({ x: 10, y: 70 }, 4)).toBe(area);
    expect(hits.query({ x: 23, y: 70 }, 1)).toBe(area);
    expect(hits.query({ x: 40, y: 70 }, 1)).toBeUndefined();
  });

  it('ranks an area containing the cursor ahead of a nearby point at equal priority', () => {
    const point = pin('point', 1, 0);
    const area: HitItem = {
      kind: 'region',
      id: 'area',
      shape: {
        type: 'area',
        polygon: [
          { x: -10, y: -10 },
          { x: 10, y: -10 },
          { x: 10, y: 10 },
          { x: -10, y: 10 },
        ],
      },
    };

    expect(createHitIndex([point, area]).query({ x: 0, y: 0 }, 1)).toBe(area);
  });

  it('can query a wide viewport and an oversized shape without enumerating empty cells', () => {
    const point = pin('point', 5e9, 0);
    const segment: HitItem = {
      kind: 'trace',
      id: 'long',
      shape: { type: 'segment', a: { x: -5e9, y: 20 }, b: { x: 5e9, y: 20 }, width: 2 },
    };
    const hits = createHitIndex([point, segment]);

    expect(hits.query({ x: 0, y: 19 }, 1)).toBe(segment);
    expect(hits.query({ x: 5e9, y: 4 }, 1e-10)).toBe(point);
  });
});
