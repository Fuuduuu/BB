import { expect, test } from 'vitest';
import { mirrorHorizontal, rotateClockwise } from './transform';

const cases = [
  ['none', 'rot90', 'mirror'],
  ['rot90', 'rot180', 'mirror_rot270'],
  ['rot180', 'rot270', 'mirror_rot180'],
  ['rot270', 'none', 'mirror_rot90'],
  ['mirror', 'mirror_rot90', 'none'],
  ['mirror_rot90', 'mirror_rot180', 'rot270'],
  ['mirror_rot180', 'mirror_rot270', 'rot180'],
  ['mirror_rot270', 'mirror', 'rot90'],
] as const;

test.each(cases)('screen_operations_compose_after_%s', (start, rotated, mirrored) => {
  expect(rotateClockwise(start)).toBe(rotated);
  expect(mirrorHorizontal(start)).toBe(mirrored);
});

test('rotate_clockwise_four_times_returns_to_start', () => {
  for (const [start] of cases) {
    expect(rotateClockwise(rotateClockwise(rotateClockwise(rotateClockwise(start))))).toBe(start);
  }
});

test('mirror_twice_returns_to_start', () => {
  for (const [start] of cases) expect(mirrorHorizontal(mirrorHorizontal(start))).toBe(start);
});
