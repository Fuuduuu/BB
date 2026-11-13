// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { snapshot } from '../../../client/src/__tests__/fakes';
import { useViewStore } from '../shell/view-store';
import { Canvas } from './Canvas';
import type { CanvasProps } from './Canvas';
import { sceneMatrix } from './stage';

afterEach(() => {
  cleanup();
  useViewStore.getState().reset();
});
function setup(fitInsets?: CanvasProps['fitInsets']) {
  const onViewChange = vi.fn<CanvasProps['onViewChange']>();
  const props = {
    layers: [],
    tools: [],
    sceneTransform: 'rot90' as const,
    surface: { width: 1000, height: 2000 },
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    onViewChange,
    snapshot: snapshot(),
    execute: () => ({ ok: true as const, value: { rev: 0 } }),
    fitInsets,
  };
  const result = render(<Canvas {...props} />);
  const svg = result.container.querySelector('svg')!;
  Object.defineProperties(svg, {
    getBoundingClientRect: {
      value: () => ({ left: 17, top: 29, right: 1617, bottom: 1229, width: 1600, height: 1200 }),
    },
    getScreenCTM: {
      value: () => ({ inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: -8.5, f: -14.5 }) }),
    },
  });
  return { svg, onViewChange };
}

test('fit_uses_area_not_covered_by_overlay_panel', () => {
  const { onViewChange } = setup({ left: 120, right: 340, top: 80, bottom: 60 });
  act(() => useViewStore.getState().requestFit());
  const { zoom, pan } = onViewChange.mock.lastCall![0];
  // root CTM scales CSS pixels by 2 and translates (17,29). The right overlay is 340 CSSpx.
  expect(zoom).toBeCloseTo(0.2565);
  const [a, b, c, d, e, f] = sceneMatrix('rot90', { width: 1000, height: 2000 })
    .slice(7, -1)
    .split(' ')
    .map(Number);
  for (const [x, y] of [
    [0, 0],
    [1000, 0],
    [1000, 2000],
    [0, 2000],
  ]) {
    const screenX = 17 + 2 * (zoom * (a! * x! + c! * y! + e!) + pan.x);
    const screenY = 29 + 2 * (zoom * (b! * x! + d! * y! + f!) + pan.y);
    expect(screenX).toBeGreaterThanOrEqual(17 + 120 + 57 - 0.001);
    expect(screenX).toBeLessThanOrEqual(1617 - 340 - 57 + 0.001);
    expect(screenY).toBeGreaterThanOrEqual(29 + 80 + 53 - 0.001);
    expect(screenY).toBeLessThanOrEqual(1229 - 60 - 53 + 0.001);
  }
});

test.each([undefined, { right: 1401 }])(
  'fit defaults or <200 CSSpx free width use whole SVG (%j)',
  (insets) => {
    const { onViewChange } = setup(insets);
    act(() => useViewStore.getState().requestFit());
    expect(onViewChange.mock.lastCall![0]).toEqual({ zoom: 0.36, pan: { x: 40, y: 120 } });
  },
);

test('fit insets never change wheel zoom or center zoom anchor', () => {
  const { svg, onViewChange } = setup({ right: 340 });
  act(() => useViewStore.getState().requestZoom(1.25));
  expect(onViewChange.mock.lastCall![0]).toEqual({ zoom: 1.25, pan: { x: -100, y: -75 } });
  fireEvent.wheel(svg, { clientX: 217, clientY: 229, deltaY: -Math.log(2) / 0.002 });
  const next = onViewChange.mock.lastCall![0];
  expect(next.zoom).toBeCloseTo(2.5);
  expect((100 - next.pan.x) / next.zoom).toBeCloseTo(160);
  expect((100 - next.pan.y) / next.zoom).toBeCloseTo(140);
});

test('fit fallback threshold stays in CSS pixels under a scaled root CTM', () => {
  const { onViewChange } = setup({ right: 1400 });
  act(() => useViewStore.getState().requestFit());
  expect(onViewChange.mock.lastCall![0]).toEqual({ zoom: 0.045, pan: { x: 5, y: 277.5 } });
});
