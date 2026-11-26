// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, assert, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import { createHitIndex } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
import { componentBodyHits, componentPinHits } from './hits';
import { PinMarker } from './PinMarker';

afterEach(cleanup);

test('oval_pad_is_drawn_as_rounded_rect', () => {
  const { container } = render(
    <svg>
      <PinMarker
        pin={{ id: '2', uid: 'pin_2', nc: false }}
        x={100}
        y={80}
        halfPx={{ x: 5.25, y: 7.5 }}
        angleDeg={90}
        shape="oval"
        zoom={1}
        selected
      />
    </svg>,
  );
  const pad = container.querySelector('[stroke="var(--ink-3)"]')!;
  expect(pad.tagName).toBe('rect');
  expect(pad.getAttribute('width')).toBe('10.5');
  expect(pad.getAttribute('height')).toBe('15');
  expect(pad.getAttribute('rx')).toBe('5.25');
  expect(pad.getAttribute('transform')).toBe('rotate(90 100 80)');
  expect(container.querySelector('[stroke="var(--sel)"]')?.getAttribute('rx')).toBe('7.25');
  expect(container.querySelector('circle')).toBeNull();
});

test('oval_pad_hits_like_drawn_shape', () => {
  const doc = newBoardDoc('Ovaalne jalg');
  const board = {
    footprint: 'to92',
    params: {},
    center: { x: 100, y: 80 },
    side: 'top' as const,
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
    customPads: {},
  };
  const component = {
    id: 'cmp_q1',
    ref: 'Q1',
    kind: 'npn' as const,
    identified: true,
    dnp: false,
    marking: '',
    value: '',
    note: '',
    pins: [{ id: '2', uid: 'pin_2', nc: false }],
    board,
  };
  doc.components.push(component);
  const snapshot = setup(doc).engine.snapshot();
  // Movement ownership is covered by the selection-kind test.
  const hits = componentPinHits(snapshot).map((hit) => {
    const geometry = { ...hit };
    delete geometry.moves;
    return geometry;
  });
  expect.soft(hits).toEqual([
    {
      kind: 'pin',
      id: '2',
      componentId: 'cmp_q1',
      priority: 2,
      shape: {
        type: 'rect',
        at: { x: 100, y: 80 },
        half: { x: 5.25, y: 7.5 },
        angleDeg: 0,
        corner: 'round',
      },
    },
  ]);
  const index = createHitIndex(hits);
  expect(index.query({ x: 100, y: 86 }, 1)?.id).toBe('2');
  expect(index.query({ x: 104, y: 81 }, 1)?.id).toBe('2');
  expect.soft(index.query({ x: 105, y: 87 }, 1)).toBeUndefined();

  const rotatedDoc = newBoardDoc('Pööratud ovaalne jalg');
  rotatedDoc.components.push({ ...component, board: { ...board, rotationDeg: 90 } });
  const rotated = createHitIndex(componentPinHits(setup(rotatedDoc).engine.snapshot()));
  expect(rotated.query({ x: 107, y: 80 }, 1)?.id).toBe('2');
  expect.soft(rotated.query({ x: 107, y: 85 }, 1)).toBeUndefined();

  const ellipseDoc = newBoardDoc('Elliptiline jalg');
  ellipseDoc.components.push({
    ...component,
    id: 'cmp_c1',
    ref: 'C1',
    kind: 'capacitor_polarized',
    board: { ...board, footprint: 'radial', scaleX: 2 },
  });
  const [ellipse] = componentPinHits(setup(ellipseDoc).engine.snapshot());
  assert(ellipse?.shape.type === 'rect');
  expect.soft(ellipse.shape).toMatchObject({ corner: 'ellipse' });
  const { at, half } = ellipse.shape;
  const ellipses = createHitIndex([ellipse]);
  expect
    .soft(ellipses.query({ x: at.x + 0.9 * half.x, y: at.y + 0.9 * half.y }, 1))
    .toBeUndefined();
  expect(ellipses.query({ x: at.x + 0.9 * half.x, y: at.y }, 1)?.id).toBe('2');
});

test('point_has_pin_hit_without_component_body_hit', () => {
  const doc = newBoardDoc('Testpunkt');
  doc.components.push({
    id: 'cmp_tp1',
    ref: 'TP1',
    kind: 'testpoint',
    identified: true,
    dnp: false,
    marking: '',
    value: '',
    note: '',
    pins: [{ id: '1', uid: 'pin_tp1', nc: false }],
    board: {
      footprint: 'point',
      params: { type: 'tp' },
      center: { x: 100, y: 80 },
      side: 'top',
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    },
  });
  const snapshot = setup(doc).engine.snapshot();
  expect(componentBodyHits(snapshot)).toEqual([]);
  expect(componentPinHits(snapshot)).toMatchObject([{ id: '1', componentId: 'cmp_tp1' }]);
});
