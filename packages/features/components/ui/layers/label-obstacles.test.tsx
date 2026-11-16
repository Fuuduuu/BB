// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement, Component } from '@pcbk/domain';
import {
  Canvas,
  createHitIndex,
  monoLabelHalf,
  sceneToScreenVector,
  screenToSceneVector,
} from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
import { COMPONENTS_LAYERS } from './index';

afterEach(cleanup);

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

function fixture(
  manual = false,
  boardOverrides: Partial<BoardPlacement> = {},
  pins: Component['pins'] = [],
) {
  const doc = newBoardDoc('Sünteetiline');
  doc.scale.pxPerMm = 10;
  doc.components.push({
    id: 'cmp_u1',
    ref: 'U1',
    value: 'LONG VALUE',
    identified: false,
    kind: 'ic',
    dnp: false,
    marking: '',
    note: '',
    pins,
    board: {
      footprint: 'qfp',
      params: {},
      center: { x: 484, y: 250 },
      side: 'bottom',
      rotationDeg: 35,
      scaleX: 1,
      scaleY: 1,
      customPads: {},
      ...(manual ? { labelOffset: { x: 7, y: -12 } } : {}),
      ...boardOverrides,
    },
  });
  return setup(doc).engine;
}

test.each(transforms)(
  'render_hit_and_obstacle_share_reference_and_value_bounds %s',
  (transform) => {
    for (const manual of [false, true]) {
      const engine = fixture(manual);
      const snapshot = engine.snapshot();
      const layer = COMPONENTS_LAYERS.find(({ id }) => id === 'components.labels')!;
      const obstacles = layer.obstacles?.(snapshot, 1, transform);
      expect(obstacles).toHaveLength(1);
      const obstacle = obstacles![0]!;
      expect(obstacle.owner).toBe('components.label');
      expect(obstacle.componentId).toBe('cmp_u1');
      const hit = layer.hits!(snapshot, 1, transform)[0]!;
      expect(hit.shape.type).toBe('area');
      if (hit.shape.type !== 'area') throw new Error('Expected label area');
      const projectedCorners = hit.shape.polygon.map((point) =>
        sceneToScreenVector(transform, {
          x: point.x - obstacle.center.x,
          y: point.y - obstacle.center.y,
        }),
      );
      expect(projectedCorners).toEqual(
        [
          { x: -obstacle.half.x, y: -obstacle.half.y },
          { x: obstacle.half.x, y: -obstacle.half.y },
          { x: obstacle.half.x, y: obstacle.half.y },
          { x: -obstacle.half.x, y: obstacle.half.y },
        ].map(({ x, y }) => ({ x: expect.closeTo(x), y: expect.closeTo(y) })),
      );

      render(
        <Canvas
          layers={[layer]}
          tools={[]}
          snapshot={snapshot}
          execute={engine.execute}
          sceneTransform={transform}
          view={{ zoom: 1, pan: { x: 0, y: 0 } }}
          onViewChange={() => {}}
        />,
      );
      const ref = screen.getByText('U1').closest('text')!;
      const value = screen.getByText('LONG VALUE');
      const refAt = { x: Number(ref.getAttribute('x')), y: Number(ref.getAttribute('y')) };
      const valueAt = { x: Number(value.getAttribute('x')), y: Number(value.getAttribute('y')) };
      const expectedValueOffset = screenToSceneVector(transform, { x: 0, y: 19.2 });
      expect(valueAt.x - refAt.x).toBeCloseTo(expectedValueOffset.x);
      expect(valueAt.y - refAt.y).toBeCloseTo(expectedValueOffset.y);
      const centerDelta = sceneToScreenVector(transform, {
        x: obstacle.center.x - refAt.x,
        y: obstacle.center.y - refAt.y,
      });
      expect(centerDelta.x).toBeCloseTo(0);
      expect(centerDelta.y).toBeCloseTo(9.6);
      expect(obstacle.half.x).toBeCloseTo(59.6);
      expect(obstacle.half.y).toBeCloseTo(21.6);
      if (manual) expect(refAt).toEqual({ x: 491, y: 238 });
      cleanup();
    }
  },
);

test('hidden_and_unplaced_labels_do_not_supply_obstacles', () => {
  const engine = fixture();
  const layer = COMPONENTS_LAYERS.find(({ id }) => id === 'components.labels')!;
  expect(layer.obstacles).toBeTypeOf('function');
  expect(layer.obstacles!(engine.snapshot(), 0.49, 'rot90')).toEqual([]);
  expect(engine.execute('components.removeFromBoard', { id: 'cmp_u1' }).ok).toBe(true);
  expect(layer.obstacles!(engine.snapshot(), 1, 'rot90')).toEqual([]);
});

test('automatic_0603_label_keeps_body_center_draggable_under_all_transforms', () => {
  for (const transform of transforms) {
    for (const zoom of [0.5, 1, 2]) {
      const engine = fixture(
        false,
        {
          footprint: 'chip',
          params: { size: '0603' },
          rotationDeg: 0,
          side: 'top',
        },
        [
          { id: '1', uid: 'pin_u1_1', nc: false },
          { id: '2', uid: 'pin_u1_2', nc: false },
        ],
      );
      expect(engine.execute('components.update', { id: 'cmp_u1', value: '' }).ok).toBe(true);
      const snapshot = engine.snapshot();
      const board = snapshot.doc.components[0]!.board!;
      const pinLayer = COMPONENTS_LAYERS.find(({ id }) => id === 'components.pins')!;
      expect(pinLayer.hits!(snapshot, zoom, transform)).toHaveLength(2);
      const hit = createHitIndex(
        COMPONENTS_LAYERS.flatMap((layer) => layer.hits?.(snapshot, zoom, transform) ?? []),
      );
      expect(hit.query(board.center, zoom)?.kind, `${transform} zoom ${zoom}`).toBe('component');
      const label = COMPONENTS_LAYERS.find(({ id }) => id === 'components.labels')!;
      const box = label.obstacles!(snapshot, zoom, transform)[0]!;
      const center = sceneToScreenVector(transform, {
        x: box.center.x - board.center.x,
        y: box.center.y - board.center.y,
      });
      expect(center.y + box.half.y).toBeLessThan(0);
      // The box must use the calibrated font and halo, rather than shrinking its hit area.
      expect(box.half).toEqual(monoLabelHalf('U1 ?', 16, zoom));
    }
  }
});

test('reference_only_obstacle_includes_unidentified_marker', () => {
  const engine = fixture(true);
  expect(engine.execute('components.update', { id: 'cmp_u1', value: '' }).ok).toBe(true);
  const layer = COMPONENTS_LAYERS.find(({ id }) => id === 'components.labels')!;
  const obstacle = layer.obstacles!(engine.snapshot(), 0.5, 'mirror_rot90')[0]!;
  expect(obstacle.center).toEqual({ x: 491, y: 238 });
  expect(obstacle.half.x).toBeCloseTo(27.04);
  expect(obstacle.half.y).toBe(14);
});
