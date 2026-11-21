// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../../measurements/__tests__/workspace';

function rectCenter(rect: SVGRectElement) {
  return {
    x: Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')) / 2,
    y: Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')) / 2,
  };
}

test('scale_preview_moves_role_ring_and_trace_end', () => {
  const pin = { pin: { c: 'cmp_u1', p: '1' } };
  const { engine, svg } = mountMeasurements({
    seed(doc) {
      doc.junctions.push({ id: 'jun_end', board: { at: { x: 280, y: 170 }, layer: 'top' } });
      doc.connections.push({
        id: 'con_trace',
        a: pin,
        b: { junction: 'jun_end' },
        basis: 'visual',
        board: { kind: 'trace', layer: 'top', widthMm: 0.3, waypoints: [] },
      });
      doc.netLabels.push({ id: 'lbl_ground', anchor: pin, roleId: 'rol_gnd', source: 'user' });
    },
  });
  const pad = () =>
    svg.querySelector<SVGRectElement>(
      '[data-layer="components.pins"] [data-component="cmp_u1"] [data-pin="1"] rect',
    )!;
  const ring = () => svg.querySelector('circle[data-pin-role="cmp_u1:1"]')!;
  const trace = () => svg.querySelector('[data-layer="connections.traces"] polyline')!;

  expect(rectCenter(pad()).x).toBeCloseTo(121.9);
  expect(Number(ring().getAttribute('cx'))).toBeCloseTo(121.9);
  expect(Number(trace().getAttribute('points')!.split(' ')[0]!.split(',')[0])).toBeCloseTo(121.9);

  act(() => {
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_u1' }] });
    // Refresh this fixture's hit index after selecting without changing the pad geometry.
    engine.execute('components.update', { id: 'cmp_u1', note: 'Valitud' });
  });
  const before = engine.snapshot();
  const handle = rectCenter(svg.querySelector<SVGRectElement>('[data-scale-handle="e"]')!);
  pointer(svg, 'pointerdown', handle.x, handle.y);
  pointer(svg, 'pointermove', handle.x + 50, handle.y);

  expect(useSessionStore.getState().preview).toMatchObject({ owner: 'components.scale' });
  expect(engine.snapshot()).toBe(before);
  const center = rectCenter(pad());
  expect(center.x).toBeCloseTo(84.4, 0);
  const [startX, startY] = trace().getAttribute('points')!.split(' ')[0]!.split(',').map(Number);
  expect.soft(Number(ring().getAttribute('cx'))).toBeCloseTo(center.x);
  expect.soft(Number(ring().getAttribute('cy'))).toBeCloseTo(center.y);
  expect.soft(startX).toBeCloseTo(center.x);
  expect.soft(startY).toBeCloseTo(center.y);
});
