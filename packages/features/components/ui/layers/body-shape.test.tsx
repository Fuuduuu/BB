// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import { Canvas, useSessionStore } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
import { useHoverStore } from '../hover-store';
import { HOVER_LAYER } from './HoverLayer';
import { COMPONENTS_LAYERS } from './index';

afterEach(() => {
  cleanup();
  useHoverStore.getState().setComponentId(null);
  useSessionStore.getState().reset('');
});

function click(svg: SVGSVGElement, x: number, y: number) {
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  }
}

test('round_body_draws_and_hits_as_circle', () => {
  const doc = newBoardDoc('Korpuse kontuuri proov');
  doc.scale.pxPerMm = 10;
  const flags = { identified: true, dnp: false, marking: '', value: '', note: '' };
  const placement = { side: 'top', rotationDeg: 0, scaleX: 1, scaleY: 1, customPads: {} } as const;
  doc.components.push(
    {
      ...flags,
      id: 'cmp_c1',
      ref: 'C1',
      kind: 'capacitor_polarized',
      pins: [
        { id: '1', uid: 'pin_c1_1', nc: false },
        { id: '2', uid: 'pin_c1_2', nc: false },
      ],
      board: {
        ...placement,
        footprint: 'radial',
        params: { D: 6.3, pitch: 2.5 },
        center: { x: 100, y: 100 },
      },
    },
    {
      ...flags,
      id: 'cmp_r1',
      ref: 'R1',
      kind: 'resistor',
      pins: [
        { id: '1', uid: 'pin_r1_1', nc: false },
        { id: '2', uid: 'pin_r1_2', nc: false },
      ],
      board: {
        ...placement,
        footprint: 'chip',
        params: { size: '0805' },
        center: { x: 220, y: 100 },
      },
    },
  );
  const { engine } = setup(doc);
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  const { container } = render(
    <Canvas
      layers={[...COMPONENTS_LAYERS, HOVER_LAYER]}
      tools={[]}
      snapshot={engine.snapshot()}
      execute={engine.execute}
      sceneTransform="none"
      view={{ zoom: 1, pan: { x: 0, y: 0 } }}
      onViewChange={() => {}}
    />,
  );
  const svg = container.querySelector('svg')!;
  Object.defineProperties(svg, {
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: vi.fn() },
  });
  Object.defineProperty(svg.querySelector('[data-scene]'), 'getScreenCTM', {
    value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
  });
  const bodyPoints = (id: string) =>
    svg
      .querySelector(`[data-layer="components.bodies"] [data-component="${id}"] polygon`)
      ?.getAttribute('points')
      ?.split(' ');

  expect.soft(bodyPoints('cmp_c1')).toHaveLength(48);
  expect(bodyPoints('cmp_r1')).toHaveLength(4);
  click(svg, 100, 120);
  expect(useSessionStore.getState().selection.items).toEqual([{ kind: 'component', id: 'cmp_c1' }]);
  click(svg, 128, 128);
  expect.soft(useSessionStore.getState().selection.items).toEqual([]);

  act(() => useHoverStore.getState().setComponentId('cmp_c1'));
  const hoverPoints = svg
    .querySelector('[data-layer="components.hover"] polygon')
    ?.getAttribute('points')
    ?.split(' ');
  expect(hoverPoints).toHaveLength(48);
});
