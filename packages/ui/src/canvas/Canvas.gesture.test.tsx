// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { snapshot } from '../../../client/src/__tests__/fakes';
import { useSessionStore } from '../shell/session-store';
import { useCursorStore } from './cursor-store';
import { Canvas, type CanvasProps } from './Canvas';
import type { LayerSpec } from './tools';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup() {
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 17,
    y: 29,
    left: 17,
    top: 29,
    right: 817,
    bottom: 629,
    width: 800,
    height: 600,
    toJSON() {},
  });
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(600);
  const renderLayer = vi.fn<LayerSpec['render']>(() => null);
  const hits = vi.fn<NonNullable<LayerSpec['hits']>>(() => []);
  const onViewChange = vi.fn<CanvasProps['onViewChange']>();
  let props: CanvasProps = {
    view: { zoom: 2, pan: { x: 20, y: 10 } },
    sceneTransform: 'none',
    layers: [{ id: 'test', z: 0, render: renderLayer, hits }],
    tools: [],
    snapshot: snapshot(),
    onViewChange,
    execute: () => ({ ok: true, value: { rev: 0 } }),
  };
  const result = render(<Canvas {...props} />);
  const svg = result.container.querySelector('svg')!;
  const group = svg.querySelector('[data-view]')!;
  const scene = svg.querySelector('[data-scene]')!;
  const ctm = vi.fn(() => ({
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: -17, f: -29 }),
  }));
  Object.defineProperty(svg, 'getScreenCTM', { value: ctm });
  Object.defineProperty(scene, 'getScreenCTM', { value: ctm });
  Object.defineProperties(svg, {
    setPointerCapture: { value() {} },
    hasPointerCapture: { value: () => false },
  });
  return {
    svg,
    group,
    bounds,
    ctm,
    hits,
    renderLayer,
    onViewChange,
    update(view: CanvasProps['view']) {
      props = { ...props, view };
      result.rerender(<Canvas {...props} />);
    },
  };
}

test('layer_without_preview_owner_gets_null_preview', () => {
  const { renderLayer } = setup();
  expect(renderLayer).toHaveBeenCalledWith(expect.objectContaining({ preview: null }));
  try {
    for (const dx of [1, 2]) {
      act(() => useSessionStore.getState().setPreview({ owner: 'select', data: { dx, dy: 0 } }));
    }
    expect(renderLayer).toHaveBeenCalledTimes(1);
  } finally {
    act(() => useSessionStore.getState().setPreview(null));
  }
});

test('wheel_zoom_keeps_cursor_point_fixed', () => {
  vi.useFakeTimers();
  const { svg, group, onViewChange } = setup();
  const point = { x: 80, y: 100 };
  const oldTransform = group.getAttribute('transform');
  fireEvent.wheel(svg, { clientX: point.x + 17, clientY: point.y + 29, deltaY: -100 });
  const after = onViewChange.mock.lastCall![0];
  expect(after.zoom).toBeGreaterThan(2);
  expect((point.x - after.pan.x) / after.zoom).toBeCloseTo(30);
  expect((point.y - after.pan.y) / after.zoom).toBeCloseTo(45);
  expect(group.getAttribute('transform')).toBe(oldTransform);
  expect(svg.style.transform).toMatch(/^matrix\(/);
  act(() => vi.advanceTimersByTime(120));
  act(() => vi.advanceTimersToNextFrame());
  expect(group.getAttribute('transform')).not.toBe(oldTransform);
  expect(svg.style.transform).toBe('');
});

test('committed_view_updates_only_on_settle', () => {
  vi.useFakeTimers();
  for (const zoom of [4, 2]) {
    const { svg, group, update, hits, renderLayer } = setup();
    const initial = group.getAttribute('transform');
    const write = vi.spyOn(group, 'setAttribute');
    update({ zoom, pan: { x: 70, y: 50 } });
    expect(group.getAttribute('transform')).toBe(initial);
    expect(write).not.toHaveBeenCalled();
    const values = svg.style.transform.match(/-?[\d.]+/g)?.map(Number);
    expect(values).toEqual(zoom === 4 ? [2, 0, 0, 2, -170, -120] : [1, 0, 0, 1, 50, 40]);
    expect(svg.style.willChange).toBe('transform');
    expect(svg.style.transformOrigin.match(/\d+/g)?.map(Number)).toEqual([0, 0]);

    act(() => vi.advanceTimersByTime(100));
    update({ zoom, pan: { x: 90, y: 70 } });
    act(() => vi.advanceTimersByTime(119));
    expect(write).not.toHaveBeenCalled();
    expect(hits).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(write).not.toHaveBeenCalled();
    act(() => vi.advanceTimersToNextFrame());
    expect(write).toHaveBeenCalledExactlyOnceWith('transform', `matrix(${zoom} 0 0 ${zoom} 90 70)`);
    expect(svg.style.transform).toBe('');
    expect(svg.style.willChange).toBe('');
    expect(hits.mock.lastCall?.[1]).toBe(zoom);
    expect(hits).toHaveBeenCalledTimes(zoom === 4 ? 2 : 1);
    expect(renderLayer).toHaveBeenCalledTimes(zoom === 4 ? 2 : 1);
    cleanup();
    vi.restoreAllMocks();
  }
});

test('gesture_recommits_when_buffer_exceeded', () => {
  vi.useFakeTimers();
  const cases = [
    [
      { zoom: 2, pan: { x: 220, y: 10 } },
      { zoom: 2, pan: { x: 221, y: 10 } },
    ],
    [
      { zoom: 2, pan: { x: -180, y: 10 } },
      { zoom: 2, pan: { x: -181, y: 10 } },
    ],
    [
      { zoom: 2, pan: { x: 20, y: 160 } },
      { zoom: 2, pan: { x: 20, y: 161 } },
    ],
    [
      { zoom: 2, pan: { x: 20, y: -140 } },
      { zoom: 2, pan: { x: 20, y: -141 } },
    ],
    // Keep the viewport centre (400, 300) anchored while crossing the zoom reserve.
    [
      { zoom: 4 / 3, pan: { x: 440 / 3, y: 320 / 3 } },
      { zoom: 1.3, pan: { x: 153, y: 111.5 } },
    ],
  ] as const;
  for (const [boundary, beyond] of cases) {
    const { svg, group, update } = setup();
    const initial = group.getAttribute('transform');
    const write = vi.spyOn(group, 'setAttribute');
    // An 800x600 viewport reserves 200px horizontally and 150px vertically.
    update(boundary);
    expect(group.getAttribute('transform')).toBe(initial);
    expect(write).not.toHaveBeenCalled();
    update(beyond);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      'transform',
      `matrix(${beyond.zoom} 0 0 ${beyond.zoom} ${beyond.pan.x} ${beyond.pan.y})`,
    );
    const residual = svg.style.transform.match(/-?[\d.]+/g)?.map(Number) ?? [1, 0, 0, 1, 0, 0];
    expect(residual).toEqual([1, 0, 0, 1, 0, 0]);
    update({ zoom: beyond.zoom, pan: { x: beyond.pan.x + 35, y: beyond.pan.y + 20 } });
    expect(write).toHaveBeenCalledTimes(1);
    expect(svg.style.transform.match(/-?[\d.]+/g)?.map(Number)).toEqual([1, 0, 0, 1, 35, 20]);
    cleanup();
    vi.restoreAllMocks();
  }
});

test('early_commit_keeps_lod_until_settle', () => {
  vi.useFakeTimers();
  const { svg, group, update, hits, renderLayer } = setup();
  const write = vi.spyOn(group, 'setAttribute');
  update({ zoom: 1.3, pan: { x: 153, y: 111.5 } });
  expect(write).toHaveBeenCalledExactlyOnceWith('transform', 'matrix(1.3 0 0 1.3 153 111.5)');
  expect(hits.mock.lastCall?.[1]).toBe(2);
  expect(hits).toHaveBeenCalledTimes(1);
  expect(renderLayer.mock.lastCall?.[0].zoom).toBe(2);
  expect(renderLayer).toHaveBeenCalledTimes(1);

  act(() => vi.advanceTimersByTime(100));
  update({ zoom: 1.4, pan: { x: 150, y: 110 } });
  act(() => vi.advanceTimersByTime(119));
  expect(write).toHaveBeenCalledTimes(1);
  expect(hits).toHaveBeenCalledTimes(1);
  expect(renderLayer).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(1));
  expect(write).toHaveBeenCalledTimes(1);
  expect(hits.mock.lastCall?.[1]).toBe(2);
  act(() => vi.advanceTimersToNextFrame());
  expect(write).toHaveBeenNthCalledWith(2, 'transform', 'matrix(1.4 0 0 1.4 150 110)');
  expect(write).toHaveBeenCalledTimes(2);
  expect(hits).toHaveBeenCalledTimes(2);
  expect(hits.mock.lastCall?.[1]).toBe(1.4);
  expect(renderLayer).toHaveBeenCalledTimes(2);
  expect(renderLayer.mock.lastCall?.[0].zoom).toBe(1.4);
  expect(svg.style.transform).toBe('');
  expect(svg.style.willChange).toBe('');
});

test('wheel_zoom_does_not_force_layout', async () => {
  vi.useFakeTimers();
  const { svg, bounds, ctm, onViewChange } = setup();
  fireEvent.pointerMove(svg, { clientX: 80, clientY: 100, pointerType: 'mouse' });
  act(() => vi.advanceTimersToNextFrame());
  bounds.mockClear();
  ctm.mockClear();

  fireEvent.wheel(svg, { clientX: 80, clientY: 100, deltaY: -Math.log(2) / 0.002 });
  await act(async () => {
    await Promise.resolve();
  });
  act(() => vi.advanceTimersToNextFrame());
  expect(bounds).not.toHaveBeenCalled();
  expect(ctm).not.toHaveBeenCalled();
  const first = onViewChange.mock.lastCall![0];
  expect(first.zoom).toBeCloseTo(4);
  expect(first.pan.x).toBeCloseTo(-23);
  expect(first.pan.y).toBeCloseTo(-51);
  expect(useCursorStore.getState().world).toEqual({ x: 21.5, y: 30.5 });

  fireEvent.wheel(svg, { clientX: 200, clientY: 180, deltaY: Math.log(2) / 0.002 });
  await act(async () => {
    await Promise.resolve();
  });
  act(() => vi.advanceTimersToNextFrame());
  const second = onViewChange.mock.lastCall![0];
  expect(second.zoom).toBeCloseTo(2);
  expect(second.pan.x).toBeCloseTo(80);
  expect(second.pan.y).toBeCloseTo(50);
  expect(bounds).not.toHaveBeenCalled();
  expect(ctm).not.toHaveBeenCalled();
});

test('pan_does_not_force_layout', () => {
  const { svg, group, bounds, ctm, onViewChange } = setup();
  bounds.mockClear();
  ctm.mockClear();
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 1 });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  };
  pointer('pointerdown', 100, 100);
  pointer('pointermove', 120, 130);
  pointer('pointermove', 150, 160);
  pointer('pointerup', 160, 180);
  expect(onViewChange.mock.lastCall![0]).toEqual({ zoom: 2, pan: { x: 80, y: 90 } });
  expect(group.getAttribute('transform')).toBe('matrix(2 0 0 2 20 10)');
  expect(svg.style.transform).toBe('matrix(1, 0, 0, 1, 60, 80)');
  expect(bounds).not.toHaveBeenCalled();
  expect(ctm).not.toHaveBeenCalled();
});
