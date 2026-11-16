import { expect, test } from 'vitest';
import { sceneToScreenVector, screenToSceneVector } from '@pcbk/ui';
import type { LabelObstacle, SceneTransform } from '@pcbk/ui';
import { placeReadingLabel } from './reading-placement';

const input = {
  at: { x: 100, y: 100 },
  half: { x: 20, y: 6 },
  textSize: 12,
  radius: 7,
  labelOffset: 9,
  isLeft: false,
  obstacles: [] as LabelObstacle[],
  placed: [] as LabelObstacle[],
  transform: 'none' as SceneTransform,
};
const candidates = [
  [9, -9],
  [-9, -9],
  [9, 9],
  [-9, 9],
  [21, -21],
  [-21, -21],
  [21, 21],
  [-21, 21],
  [33, -33],
  [-33, -33],
  [33, 33],
  [-33, 33],
  [45, -45],
  [-45, -45],
  [45, 45],
  [-45, 45],
] as const;
const transforms: SceneTransform[] = [
  'none',
  'rot90',
  'rot180',
  'rot270',
  'mirror',
  'mirror_rot90',
  'mirror_rot180',
  'mirror_rot270',
];

test('reading_placement_tries_all_candidates_in_card_order_under_all_8_transforms', () => {
  for (const transform of transforms) {
    const obstacles: LabelObstacle[] = [];
    for (const [index, [x, y]] of candidates.entries()) {
      const result = placeReadingLabel({ ...input, transform, obstacles });
      expect(result.offset, `${transform}:${index}`).toEqual({ x, y });
      expect(result.textAnchor).toBe(x < 0 ? 'end' : 'start');
      const center = sceneToScreenVector(transform, {
        x: result.box.center.x - 100,
        y: result.box.center.y - 100,
      });
      expect(center).toEqual({ x: x + Math.sign(x) * 20, y });
      expect(Boolean(result.leader)).toBe(index >= 4);
      const delta = screenToSceneVector(transform, { x: x + Math.sign(x) * 20, y });
      obstacles.push({
        owner: 'test.label',
        center: { x: 100 + delta.x, y: 100 + delta.y },
        half: { x: 1, y: 1 },
      });
    }
    // All sixteen choices blocked: the original location is the specified fallback.
    const fallback = placeReadingLabel({ ...input, transform, obstacles });
    expect(fallback.offset).toEqual({ x: 9, y: -9 });
    expect(fallback.leader).toBeUndefined();
  }
});

test('reading_placement_is_deterministic', () => {
  const first = placeReadingLabel(input);
  const second = placeReadingLabel({ ...input, placed: [first.box] });
  expect(first.offset).toEqual({ x: 9, y: -9 });
  expect(second.offset).toEqual({ x: -9, y: -9 });
  for (let iteration = 0; iteration < 5; iteration++) {
    expect(placeReadingLabel(input)).toEqual(first);
    expect(placeReadingLabel({ ...input, placed: [first.box] })).toEqual(second);
  }
  expect(input.placed).toEqual([]);
  expect(input.obstacles).toEqual([]);
});

test('reading_placement_left_pin_keeps_left_first_and_bottom_right_before_bottom_left', () => {
  const first = placeReadingLabel({ ...input, isLeft: true });
  const second = placeReadingLabel({ ...input, isLeft: true, placed: [first.box] });
  const third = placeReadingLabel({ ...input, isLeft: true, placed: [first.box, second.box] });
  expect(first.offset).toEqual({ x: -9, y: -9 });
  expect(second.offset).toEqual({ x: 9, y: -9 });
  expect(third.offset).toEqual({ x: 9, y: 9 });
  expect(third.leader).toBeUndefined();
});

test('reading_placement_leader_runs_from_ring_edge_to_nearest_box_point', () => {
  const result = placeReadingLabel({
    ...input,
    obstacles: [{ owner: 'test.label', center: input.at, half: { x: 200, y: 14 } }],
  });
  expect(result.offset).toEqual({ x: 21, y: -21 });
  expect(result.leader!.end).toEqual({ x: 121, y: 85 });
  expect(Math.hypot(result.leader!.start.x - 100, result.leader!.start.y - 100)).toBeCloseTo(7);
  expect((result.leader!.start.x - 100) / (result.leader!.start.y - 100)).toBeCloseTo(-21 / 15);
});
