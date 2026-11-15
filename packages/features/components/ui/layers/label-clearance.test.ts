import { expect, test } from 'vitest';
import type { BoardPlacement } from '@pcbk/domain';
import { componentLabelLayout } from './hits';

function board(footprint: string, overrides: Partial<BoardPlacement> = {}): BoardPlacement {
  return {
    footprint,
    params: {},
    center: { x: 484, y: 250 },
    side: 'top',
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
    customPads: {},
    ...overrides,
  };
}

test.each([
  ['qfp', 0, 175],
  ['qfp', 90, 175],
  ['sot223', 0, 198.5],
  ['sot223', 90, 207.5],
  ['sot223', 180, 198.5],
] as const)('automatic_label_clears_protruding_pads %s %i', (footprint, rotationDeg, expectedY) => {
  const layout = componentLabelLayout(board(footprint, { rotationDeg }), 10);
  expect(layout.at.x).toBe(484);
  expect(layout.at.y).toBeCloseTo(expectedY);
});

test('automatic_label_reserves_value_line_above_qfp_pads', () => {
  const layout = componentLabelLayout(board('qfp'), 10, true);
  // Top-row pads begin 65px above the center. Both text lines end above y=185.
  expect(layout.at.y).toBeCloseTo(155.8);
  expect(layout.valueY).toBeCloseTo(175);
  expect(layout.valueY + layout.textSize / 2).toBeLessThan(185);
});

test('manual_label_offset_is_preserved_with_protruding_pads_and_value', () => {
  const layout = componentLabelLayout(board('qfp', { labelOffset: { x: 7, y: -12 } }), 10, true);
  expect(layout.offset).toEqual({ x: 7, y: -12 });
  expect(layout.at).toEqual({ x: 491, y: 238 });
});

test('already_clear_chip_label_keeps_its_default_position', () => {
  const layout = componentLabelLayout(board('chip', { center: { x: 100, y: 80 } }), 10);
  expect(layout.at).toEqual({ x: 100, y: 63.75 });
});
