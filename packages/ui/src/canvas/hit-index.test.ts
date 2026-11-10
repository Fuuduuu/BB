import { describe, expect, it } from 'vitest';
import { createHitIndex, type HitItem } from './hit-index';

function pin(id: string, x: number, y: number, r = 1): HitItem {
  return { kind: 'pin', id, shape: { type: 'point', at: { x, y }, r } };
}

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
