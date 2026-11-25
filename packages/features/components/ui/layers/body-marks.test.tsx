// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, assert, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement, Component, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { Canvas, useSessionStore } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
import { COMPONENTS_LAYERS } from './index';

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
});

function component(
  id: string,
  ref: string,
  kind: Component['kind'],
  board: BoardPlacement,
  pinCount: number,
): Component {
  return {
    id,
    ref,
    kind,
    board,
    identified: true,
    dnp: false,
    marking: '',
    value: '',
    note: '',
    pins: Array.from({ length: pinCount }, (_, index) => ({
      id: String(index + 1),
      uid: `pin_${id.slice(4)}_${index + 1}`,
      nc: false,
    })),
  };
}

function pathPoints(path: SVGPathElement): Vec2[] {
  const data = path.getAttribute('d');
  assert(data);
  return data
    .split(/[MLZ]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [x, y] = part.split(/[\s,]+/).map(Number);
      assert(x !== undefined && y !== undefined);
      return { x, y };
    });
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test('body_marks_draw_on_canvas', () => {
  const doc = newBoardDoc('Korpuse märkide proov');
  doc.scale.pxPerMm = 10;
  const placement = { side: 'top', rotationDeg: 0, scaleX: 1, scaleY: 1, customPads: {} } as const;
  const radial: BoardPlacement = {
    ...placement,
    footprint: 'radial',
    params: { D: 6.3, pitch: 2.5 },
    side: 'bottom',
    rotationDeg: 90,
    center: { x: 100, y: 100 },
  };
  doc.components.push(
    component('cmp_c1', 'C1', 'capacitor_polarized', radial, 2),
    component(
      'cmp_u1',
      'U1',
      'ic',
      {
        ...placement,
        footprint: 'soic',
        params: { pins: 8, body: 3.9 },
        center: { x: 220, y: 100 },
      },
      8,
    ),
    component(
      'cmp_r1',
      'R1',
      'resistor',
      {
        ...placement,
        footprint: 'chip',
        params: { size: '0805' },
        center: { x: 340, y: 100 },
      },
      2,
    ),
  );
  const { engine } = setup(doc);
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  const { container } = render(
    <Canvas
      layers={COMPONENTS_LAYERS}
      tools={[]}
      snapshot={engine.snapshot()}
      execute={engine.execute}
      sceneTransform="none"
      view={{ zoom: 1, pan: { x: 0, y: 0 } }}
      onViewChange={() => {}}
    />,
  );
  const body = (id: string) => {
    const group = container.querySelector(
      `[data-layer="components.bodies"] [data-component="${id}"]`,
    );
    assert(group);
    return group;
  };
  const plusPaths = body('cmp_c1').querySelectorAll<SVGPathElement>('path[data-mark="plus"]');
  const bandPaths = body('cmp_c1').querySelectorAll<SVGPathElement>('path[data-mark="band"]');
  expect(plusPaths).toHaveLength(1);
  expect(bandPaths).toHaveLength(1);
  const [plus] = plusPaths;
  const [band] = bandPaths;
  assert(plus && band);
  expect(plus.getAttribute('stroke-dasharray')).toBe('4 3');
  expect(band.getAttribute('stroke-dasharray')).toBe('4 3');

  const pads = boardPads(radial, ['1', '2'], doc.scale.pxPerMm);
  const positive = pads.find(({ pinId }) => pinId === '1')?.at;
  const negative = pads.find(({ pinId }) => pinId === '2')?.at;
  assert(positive && negative);
  const bandPoints = pathPoints(band);
  expect(bandPoints.length).toBeGreaterThan(2);
  for (const point of bandPoints) {
    expect(distance(point, negative)).toBeLessThan(distance(point, positive));
  }
  const plusPoints = pathPoints(plus);
  expect(plusPoints).toHaveLength(4);
  const plusCenter = plusPoints.reduce(
    (center, { x, y }) => ({
      x: center.x + x / plusPoints.length,
      y: center.y + y / plusPoints.length,
    }),
    { x: 0, y: 0 },
  );
  expect(distance(plusCenter, positive)).toBeLessThan(distance(plusCenter, negative));

  const soic = body('cmp_u1');
  const notch = soic.querySelector('path[data-mark="notch"]');
  assert(notch);
  expect(notch.hasAttribute('stroke-dasharray')).toBe(false);
  const pin1Dot = soic.querySelector('circle');
  assert(pin1Dot);
  expect(pin1Dot.previousElementSibling).toBe(notch);
  expect(body('cmp_r1').querySelector('[data-mark]')).toBeNull();
});
