import { expect, test } from 'vitest';
import type { BoardPlacement } from '@pcbk/domain';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { boardPads } from '@pcbk/domain/geometry';
import { monoLabelHalf, sceneToScreenVector } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
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
  ['qfp', 0, 172],
  ['qfp', 90, 172],
  ['sot223', 0, 195.5],
  ['sot223', 90, 204.5],
  ['sot223', 180, 195.5],
] as const)('automatic_label_clears_protruding_pads %s %i', (footprint, rotationDeg, expectedY) => {
  const layout = componentLabelLayout(board(footprint, { rotationDeg }), 10);
  expect(layout.at.x).toBe(484);
  expect(layout.at.y).toBeCloseTo(expectedY);
});

test('automatic_label_reserves_value_line_above_qfp_pads', () => {
  const layout = componentLabelLayout(board('qfp'), 10, true);
  // Full calibrated box, including halo, ends one screen pixel above the pads.
  expect(layout.at.y).toBeCloseTo(152.8);
  expect(layout.valueY).toBeCloseTo(172);
  expect(layout.valueY + monoLabelHalf('MCU', layout.textSize, 1).y).toBeCloseTo(184);
});

test('manual_label_offset_is_preserved_with_protruding_pads_and_value', () => {
  const layout = componentLabelLayout(board('qfp', { labelOffset: { x: 7, y: -12 } }), 10, true);
  expect(layout.offset).toEqual({ x: 7, y: -12 });
  expect(layout.at).toEqual({ x: 491, y: 238 });
});

test('chip_label_reserves_calibrated_text_and_halo_above_pads', () => {
  const layout = componentLabelLayout(board('chip', { center: { x: 100, y: 80 } }), 10);
  expect(layout.at).toEqual({ x: 100, y: 60.25 });
});

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

test('auto_label_clears_pads_in_rotated_and_mirrored_scene', () => {
  for (const transform of transforms) {
    for (const footprint of ['qfp', 'sot223', 'pinhdr1xn', 'area']) {
      for (const rotationDeg of [0, 35, 90]) {
        const placement = board(footprint, {
          rotationDeg,
          side: 'bottom',
          customPads: {
            custom: { local: { x: 9, y: -7 }, sizeMm: 2, shape: 'circle', through: true },
          },
        });
        const layout = componentLabelLayout(placement, 10, true, transform);
        const ref = sceneToScreenVector(transform, layout.offset);
        expect(ref.x).toBeCloseTo(0);
        expect(ref.y).toBeLessThan(0);
        const textBottom =
          ref.y + 1.2 * layout.textSize + monoLabelHalf('MCU', layout.textSize, 1).y;
        const ids = [
          ...(footprintGeometry(footprint, placement.params)?.pads.map(({ id }) => id) ?? []),
          'custom',
        ];
        for (const pad of boardPads(placement, ids, 10)) {
          const center = sceneToScreenVector(transform, {
            x: pad.at.x - placement.center.x,
            y: pad.at.y - placement.center.y,
          });
          const angle = (pad.angleDeg * Math.PI) / 180;
          const axisX = sceneToScreenVector(transform, { x: Math.cos(angle), y: Math.sin(angle) });
          const axisY = sceneToScreenVector(transform, { x: -Math.sin(angle), y: Math.cos(angle) });
          const extent =
            pad.shape === 'circle'
              ? pad.halfPx.x
              : Math.abs(axisX.y) * pad.halfPx.x + Math.abs(axisY.y) * pad.halfPx.y;
          expect(textBottom).toBeLessThan(center.y - extent);
        }
      }
    }
  }
});

test('manual_label_offset_is_preserved_under_all_scene_transforms', () => {
  for (const transform of transforms) {
    const placement = board('qfp', { labelOffset: { x: 7, y: -12 } });
    const layout = componentLabelLayout(placement, 10, true, transform);
    expect(layout.offset).toEqual({ x: 7, y: -12 });
    expect(layout.at).toEqual({ x: 491, y: 238 });
    expect(placement.labelOffset).toEqual({ x: 7, y: -12 });
  }
});
