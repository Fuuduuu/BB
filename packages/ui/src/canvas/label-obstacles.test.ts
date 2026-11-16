import { expect, test } from 'vitest';
import * as canvas from './index';
import type { SceneTransform } from './stage';

test('mono_label_half_covers_measured_chromium_box', () => {
  expect(canvas.monoLabelHalf).toBeTypeOf('function');
  const half = canvas.monoLabelHalf('3,651 V', 12, 1);
  // Independent Chromium measurement: glyph bounds are 59.4 x 15px; halo plus safety is 2px/side.
  expect(half.x - 2).toBeGreaterThanOrEqual(29.7);
  expect(half.y - 2).toBeGreaterThanOrEqual(7.5);
});

test('mono_label_half_keeps_halo_and_safety_in_screen_pixels', () => {
  expect(canvas.monoLabelHalf).toBeTypeOf('function');
  expect(canvas.monoLabelHalf('AB', 10, 2)).toEqual({ x: 8.2, y: 7.25 });
  expect(canvas.monoLabelHalf('AB', 10, 0.5, 4)).toEqual({ x: 13.2, y: 12.25 });
  expect(canvas.monoLabelHalf('A😀', 10, 1, 0)).toEqual({ x: 8.2, y: 7.25 });
});

test('screen_boxes_overlap_under_all_8_transforms', () => {
  expect(canvas.screenBoxesOverlap).toBeTypeOf('function');
  const a = { owner: 'label', center: { x: 10, y: 20 }, half: { x: 8, y: 1 } };
  const cases: [SceneTransform, number, number, number, number][] = [
    ['none', 9, 1, 1, 3],
    ['rot90', 1, -9, 3, -1],
    ['rot180', -9, -1, -1, -3],
    ['rot270', -1, 9, -3, 1],
    ['mirror', -9, 1, -1, 3],
    ['mirror_rot90', -1, -9, -3, -1],
    ['mirror_rot180', 9, -1, 1, -3],
    ['mirror_rot270', 1, 9, 3, 1],
  ];
  for (const [transform, overlapX, overlapY, clearX, clearY] of cases) {
    const b = {
      owner: 'reading',
      center: { x: 10 + overlapX, y: 20 + overlapY },
      half: { x: 2, y: 1 },
    };
    expect(canvas.screenBoxesOverlap(a, b, transform), transform).toBe(true);
    expect(canvas.screenBoxesOverlap(b, a, transform), transform).toBe(true);
    expect(
      canvas.screenBoxesOverlap(a, { ...b, center: { x: 10 + clearX, y: 20 + clearY } }, transform),
      transform,
    ).toBe(false);
  }
});

test('screen_boxes_that_only_touch_do_not_overlap', () => {
  expect(canvas.screenBoxesOverlap).toBeTypeOf('function');
  const a = { owner: 'label', center: { x: 0, y: 0 }, half: { x: 8, y: 1 } };
  expect(canvas.screenBoxesOverlap(a, { ...a, center: { x: 16, y: 0 } }, 'none')).toBe(false);
  expect(canvas.screenBoxesOverlap(a, a, 'none')).toBe(true);
});
