// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement, Component, Vec2 } from '@pcbk/domain';
import { footprintPinIds } from '@pcbk/domain/footprints';
import { bodyOutline, boardPads } from '@pcbk/domain/geometry';
import {
  Canvas,
  createHitIndex,
  monoLabelHalf,
  sceneToScreenVector,
  screenToSceneVector,
  useSessionStore,
} from '@pcbk/ui';
import type { CanvasProps, SceneTransform } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
import { componentLabelBox } from './hits';
import { COMPONENTS_LAYERS } from './index';

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
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

test('long_value_avoids_neighbour_component', () => {
  const value = 'STM32F103C8T6 LQFP48';
  const doc = newBoardDoc('Tihe plaat');
  const pxPerMm = 10;
  const zoom = 0.5;
  const view = { zoom, pan: { x: 0, y: 0 } };
  doc.scale.pxPerMm = pxPerMm;

  function placed(id: string, ref: string, footprint: string, center: Vec2, value = '') {
    const board: BoardPlacement = {
      footprint,
      params: {},
      center,
      side: 'top',
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    };
    const pins = footprintPinIds(footprint, {})!.map((pinId) => ({
      id: pinId,
      uid: `pin_${id}_${pinId}`,
      nc: false,
    }));
    return {
      id,
      ref,
      kind: 'ic',
      marking: '',
      value,
      identified: true,
      dnp: false,
      note: '',
      pins,
      board,
    } as const;
  }

  const primary = placed('cmp_u1', 'U1', 'soic', { x: 160, y: 160 }, value);
  const neighbour = placed('cmp_r1', 'R1', 'chip', { x: 188, y: 112 });
  doc.components.push(primary, neighbour);
  const { engine } = setup(doc);
  const snapshot = engine.snapshot();
  const before = componentLabelBox(primary, pxPerMm, zoom, 'none').box;
  const boxes = (component: typeof primary) => {
    const outline = bodyOutline(component.board, pxPerMm);
    const pads = boardPads(
      component.board,
      component.pins.map(({ id }) => id),
      pxPerMm,
    );
    return [
      {
        left: Math.min(...outline.map(({ x }) => x)),
        right: Math.max(...outline.map(({ x }) => x)),
        top: Math.min(...outline.map(({ y }) => y)),
        bottom: Math.max(...outline.map(({ y }) => y)),
      },
      ...pads.map(({ at, halfPx }) => ({
        left: at.x - Math.max(halfPx.x, 2.5 / zoom),
        right: at.x + Math.max(halfPx.x, 2.5 / zoom),
        top: at.y - Math.max(halfPx.y, 2.5 / zoom),
        bottom: at.y + Math.max(halfPx.y, 2.5 / zoom),
      })),
    ];
  };
  const intersects = (
    { center, half }: typeof before,
    { left, right, top, bottom }: ReturnType<typeof boxes>[number],
  ) =>
    center.x - half.x < right &&
    center.x + half.x > left &&
    center.y - half.y < bottom &&
    center.y + half.y > top;
  expect(
    boxes(neighbour)
      .slice(1)
      .some((bounds) => intersects(before, bounds)),
  ).toBe(true);

  const layer = COMPONENTS_LAYERS.find(({ id }) => id === 'components.labels')!;
  const props: Omit<CanvasProps, 'snapshot'> = {
    layers: COMPONENTS_LAYERS,
    tools: [],
    moveRefs: (_snapshot, items) =>
      items.some(({ kind, id }) => kind === 'component' && id === primary.id)
        ? [{ kind: 'component', id: primary.id }]
        : [],
    view,
    sceneTransform: 'none' as const,
    onViewChange: () => {},
    execute: engine.execute,
  };
  const { container, rerender } = render(<Canvas {...props} snapshot={snapshot} />);
  const svg = container.querySelector('svg')!;
  const reference = screen.getByText('U1');
  const renderedAt = {
    x: Number(reference.getAttribute('x')),
    y: Number(reference.getAttribute('y')),
  };
  expect(renderedAt.y).toBeGreaterThan(primary.board.center.y);
  expect(renderedAt.x).toBe(primary.board.center.x);
  expect(Number(screen.getByText(value).getAttribute('y')) - renderedAt.y).toBeCloseTo(19.2);

  const obstacle = layer.obstacles!(snapshot, zoom, 'none').find(
    ({ componentId }) => componentId === primary.id,
  )!;
  expect(obstacle.center.x).toBe(renderedAt.x);
  expect(obstacle.center.y - renderedAt.y).toBeCloseTo(9.6);
  expect(
    [...boxes(primary), ...boxes(neighbour)].some((bounds) => intersects(obstacle, bounds)),
  ).toBe(false);

  const hits = COMPONENTS_LAYERS.flatMap((entry) => entry.hits?.(snapshot, zoom, 'none') ?? []);
  const match = createHitIndex(hits).query(renderedAt, zoom);
  expect(match).toMatchObject({
    kind: 'component-label',
    id: primary.id,
    drag: { owner: 'components.label' },
  });
  if (match?.shape.type !== 'area') throw new Error('Expected label hit area');
  expect(match.shape.polygon).toEqual([
    { x: obstacle.center.x - obstacle.half.x, y: obstacle.center.y - obstacle.half.y },
    { x: obstacle.center.x + obstacle.half.x, y: obstacle.center.y - obstacle.half.y },
    { x: obstacle.center.x + obstacle.half.x, y: obstacle.center.y + obstacle.half.y },
    { x: obstacle.center.x - obstacle.half.x, y: obstacle.center.y + obstacle.half.y },
  ]);

  expect(
    engine.execute('items.translate', {
      items: [{ kind: 'component', id: neighbour.id }],
      dx: 180,
      dy: 0,
    }).ok,
  ).toBe(true);
  const movedNeighbour = engine.snapshot();
  expect(movedNeighbour.doc.components[0]).toBe(snapshot.doc.components[0]);
  rerender(<Canvas {...props} snapshot={movedNeighbour} />);
  const movedReference = screen.getByText('U1');
  const top = {
    x: Number(movedReference.getAttribute('x')),
    y: Number(movedReference.getAttribute('y')),
  };
  expect(top.x).toBe(before.center.x);
  expect(top.y).toBeCloseTo(before.center.y - 9.6);
  const movedObstacle = layer.obstacles!(movedNeighbour, zoom, 'none').find(
    ({ componentId }) => componentId === primary.id,
  )!;
  expect(movedObstacle).toEqual(before);
  const movedHits = createHitIndex(layer.hits!(movedNeighbour, zoom, 'none'));
  expect(movedHits.query(top, zoom)?.id).toBe(primary.id);
  expect(movedHits.query(renderedAt, zoom)).toBeUndefined();

  expect(engine.undo().ok).toBe(true);
  const restored = engine.snapshot();
  rerender(<Canvas {...props} snapshot={restored} />);

  Object.defineProperties(svg, {
    setPointerCapture: { value: () => {} },
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: () => {} },
  });
  Object.defineProperty(svg.querySelector('[data-scene]')!, 'getScreenCTM', {
    value: () => ({ inverse: () => ({ a: 1 / zoom, b: 0, c: 0, d: 1 / zoom, e: 0, f: 0 }) }),
  });
  const pointer = (type: string, { x, y }: Vec2) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      clientX: x * zoom,
      clientY: y * zoom,
      button: 0,
    });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  };
  const center = primary.board.center;
  pointer('pointerdown', center);
  pointer('pointermove', { x: center.x + 12, y: center.y - 8 });
  expect(reference.closest('[data-component]')?.getAttribute('transform')).toBe('translate(12 -8)');
  expect(reference.getAttribute('y')).toBe(String(renderedAt.y));
  expect(engine.snapshot()).toBe(restored);
  pointer('pointercancel', center);
  expect(reference.closest('[data-component]')?.hasAttribute('transform')).toBe(false);

  pointer('pointerdown', renderedAt);
  pointer('pointermove', { x: renderedAt.x + 12, y: renderedAt.y + 8 });
  pointer('pointerup', { x: renderedAt.x + 12, y: renderedAt.y + 8 });
  const dragged = engine.snapshot();
  expect(dragged.doc.components[0]!.board!.labelOffset).toEqual({
    x: 12,
    y: expect.closeTo(renderedAt.y - center.y + 8),
  });
  rerender(<Canvas {...props} snapshot={dragged} />);
  expect(Number(screen.getByText('U1').getAttribute('x'))).toBeCloseTo(renderedAt.x + 12);
  expect(Number(screen.getByText('U1').getAttribute('y'))).toBeCloseTo(renderedAt.y + 8);
});
