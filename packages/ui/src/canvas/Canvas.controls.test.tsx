// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EngineProvider, useSnapshot } from '@pcbk/client';
import { Profiler } from 'react';
import { useCursorStore } from './cursor-store';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { AppShell } from '../shell/AppShell';
import { useViewStore } from '../shell/view-store';
import { Canvas } from './Canvas';
import type { SceneTransform } from './stage';
import type { LayerSpec } from './tools';

type Matrix = [number, number, number, number, number, number];
const rootMatrices = new WeakMap<Element, Matrix>();
function matrixOf(element: Element): Matrix {
  const parent = element.parentElement;
  const left = parent?.closest('svg')
    ? matrixOf(parent)
    : (rootMatrices.get(element) ?? [2, 0, 0, 2, 17, 29]);
  const attribute = element.getAttribute('transform');
  if (!attribute) return left as Matrix;
  const [a, b, c, d, e, f] = left;
  const [g, h, i, j, k, l] = attribute.slice(7, -1).split(' ').map(Number) as Matrix;
  return [
    a! * g + c! * h,
    b! * g + d! * h,
    a! * i + c! * j,
    b! * i + d! * j,
    a! * k + c! * l + e!,
    b! * k + d! * l + f!,
  ];
}
function installCtm(element: Element) {
  Object.defineProperty(element, 'getScreenCTM', {
    value: () => {
      const [a, b, c, d, e, f] = matrixOf(element);
      const det = a * d - b * c;
      return {
        inverse: () => ({
          a: d / det,
          b: -b / det,
          c: -c / det,
          d: a / det,
          e: (c * f - d * e) / det,
          f: (b * e - a * f) / det,
        }),
      };
    },
  });
}
const surface = { width: 1000, height: 2000 };
const layers: LayerSpec[] = [{ id: 'test', z: 0, render: vi.fn(() => <circle r={1} />) }];
const canvasCommits = vi.fn();
const execute = vi.fn(() => ({ ok: true as const, value: { rev: 0 } }));
function setup(sceneTransform: SceneTransform = 'rot90') {
  const engine = new FakeEngine(snapshot());
  function Board() {
    const current = useSnapshot((s) => s);
    const view = useViewStore((s) => s.boardView);
    return (
      <Profiler id="canvas" onRender={canvasCommits}>
        <Canvas
          layers={layers}
          tools={[]}
          sceneTransform={sceneTransform}
          surface={surface}
          view={view}
          onViewChange={useViewStore.getState().setBoardView}
          snapshot={current}
          execute={execute}
        />
      </Profiler>
    );
  }
  const result = render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell
        canvas={<Board />}
        onRetrySave={() => {}}
        onSaveElsewhere={() => {}}
        onCopyAndReload={() => {}}
        onExportDiagnostics={() => {}}
      />
    </EngineProvider>,
  );
  const svg = result.container.querySelector('svg[tabindex]')!;
  const scene = svg.querySelector('[data-scene]')!;
  installCtm(svg);
  installCtm(scene);
  let bounds = { left: 17, top: 29, right: 1617, bottom: 1229, width: 1600, height: 1200 };
  Object.defineProperty(svg, 'getBoundingClientRect', { value: () => bounds });
  return {
    ...result,
    engine,
    svg,
    scene,
    transform(next: SceneTransform) {
      sceneTransform = next;
      const current = engine.snapshot();
      engine.replace({ ...current, rev: current.rev + 1 });
    },
    viewport(matrix: Matrix, nextBounds = bounds, dispatchResize = true) {
      rootMatrices.set(svg, matrix);
      bounds = nextBounds;
      if (dispatchResize) fireEvent(window, new Event('resize'));
    },
  };
}
beforeEach(() => {
  useViewStore.getState().reset();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test.each([
  'none',
  'rot90',
  'rot180',
  'rot270',
  'mirror',
  'mirror_rot90',
  'mirror_rot180',
  'mirror_rot270',
] as const)('zoom_buttons_and_fit_show_whole_rotated_surface (%s)', (transform) => {
  const { scene, engine } = setup(transform);
  expect(screen.getByText('100 %')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Suurenda' }));
  expect(useViewStore.getState().boardView).toEqual({ zoom: 1.25, pan: { x: -100, y: -75 } });
  expect(screen.getByText('125 %')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Vähenda' }));
  expect(useViewStore.getState().boardView).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  fireEvent.click(screen.getByRole('button', { name: 'Sobita' }));
  const [a, b, c, d, e, f] = matrixOf(scene);
  for (const [x, y] of [
    [0, 0],
    [1000, 0],
    [1000, 2000],
    [0, 2000],
  ]) {
    const screenX = a * x! + c * y! + e;
    const screenY = b * x! + d * y! + f;
    expect(screenX).toBeGreaterThanOrEqual(17 + 80 - 0.001);
    expect(screenX).toBeLessThanOrEqual(1617 - 80 + 0.001);
    expect(screenY).toBeGreaterThanOrEqual(29 + 60 - 0.001);
    expect(screenY).toBeLessThanOrEqual(1229 - 60 + 0.001);
  }
  expect(execute).not.toHaveBeenCalled();
  expect(engine.snapshot().rev).toBe(0);
});

test.each([0.05, 32, 0.01, 64])(
  'zoom buttons preserve limits and allow saved zoom to return (%s)',
  (zoom) => {
    act(() => useViewStore.getState().setBoardView({ zoom, pan: { x: 0, y: 0 } }));
    setup();
    const outward = zoom <= 0.05 ? 'Vähenda' : 'Suurenda';
    fireEvent.click(screen.getByRole('button', { name: outward }));
    expect(useViewStore.getState().boardView.zoom).toBe(zoom);
    fireEvent.click(screen.getByRole('button', { name: zoom <= 0.05 ? 'Suurenda' : 'Vähenda' }));
    expect(useViewStore.getState().boardView.zoom).toBeCloseTo(
      zoom <= 0.05 ? zoom * 1.25 : zoom / 1.25,
    );
  },
);

test('cursor_readout_shows_mm_and_dash_outside', () => {
  vi.useFakeTimers();
  const { svg, engine, unmount } = setup();
  expect(screen.getByText('X — · Y —')).toBeTruthy();
  const renders = vi.mocked(layers[0]!.render).mock.calls.length;
  const [a, b, c, d, e, f] = matrixOf(svg.querySelector('[data-scene]')!);
  const move = (x: number, y: number, pointerType = 'mouse') => {
    const event = new MouseEvent('pointermove', {
      bubbles: true,
      clientX: a * x + c * y + e,
      clientY: b * x + d * y + f,
    });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    fireEvent(svg, event);
  };
  // rot90 maps this world point inside the viewport.
  act(() => useViewStore.getState().setBoardView({ zoom: 0.25, pan: { x: 0, y: 0 } }));
  const [aa, bb, cc, dd, ee, ff] = matrixOf(svg.querySelector('[data-scene]')!);
  const event = new MouseEvent('pointermove', {
    bubbles: true,
    clientX: aa * 123 + cc * 45 + ee,
    clientY: bb * 123 + dd * 45 + ff,
  });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  const commits = canvasCommits.mock.calls.length;
  const updates = vi.fn();
  const unsubscribe = useCursorStore.subscribe(updates);
  fireEvent(svg, event);
  fireEvent(svg, event);
  fireEvent(svg, event);
  expect(updates).not.toHaveBeenCalled();
  expect(screen.getByText('X — · Y —')).toBeTruthy();
  act(() => vi.advanceTimersToNextFrame());
  expect(screen.getByText('X 12,3 mm · Y 4,5 mm')).toBeTruthy();
  expect(updates).toHaveBeenCalledTimes(1);
  unsubscribe();
  expect(canvasCommits).toHaveBeenCalledTimes(commits);
  expect(vi.mocked(layers[0]!.render).mock.calls.length).toBe(renders);
  const current = engine.snapshot();
  act(() =>
    engine.replace({
      ...current,
      rev: 1,
      doc: { ...current.doc, scale: { pxPerMm: 5, calibrated: true } },
    }),
  );
  expect(screen.getByText('X 24,6 mm · Y 9,0 mm')).toBeTruthy();
  fireEvent.pointerLeave(svg);
  expect(screen.getByText('X — · Y —')).toBeTruthy();
  move(123, 45, 'touch');
  act(() => vi.advanceTimersToNextFrame());
  expect(screen.getByText('X — · Y —')).toBeTruthy();
  fireEvent(svg, event);
  act(() => vi.advanceTimersToNextFrame());
  expect(screen.getByText('X 24,6 mm · Y 9,0 mm')).toBeTruthy();
  act(() => engine.replace(snapshot('next-session')));
  expect(screen.getByText('X — · Y —')).toBeTruthy();
  fireEvent(svg, event);
  act(() => vi.advanceTimersToNextFrame());
  fireEvent.pointerMove(svg, { clientX: 5000, clientY: 5000 });
  expect(screen.getByText('X — · Y —')).toBeTruthy();
  fireEvent(svg, event);
  unmount();
  act(() => vi.advanceTimersToNextFrame());
  expect(useCursorStore.getState().world).toBeNull();
  expect(execute).not.toHaveBeenCalled();
});

test('bottom_bar_has_no_ready_label', () => {
  setup();
  const bar = screen.getByRole('contentinfo', { name: 'Plaadi olek' });
  expect(bar.textContent).not.toContain('Valmis');
  expect(bar.querySelector('.pcbk-ready')).toBeNull();
  expect(screen.getByRole('button', { name: 'Sobita' })).toBeTruthy();
});

test('restoring and resetting a mounted canvas never replays old requests', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Sobita' }));
  const saved = useViewStore.getState().getView();
  saved.boardView = { zoom: 3, pan: { x: 7, y: 9 } };
  act(() => useViewStore.getState().restore(saved));
  expect(useViewStore.getState().boardView).toEqual(saved.boardView);
  act(() => useViewStore.getState().reset());
  expect(useViewStore.getState().boardView).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  fireEvent.click(screen.getByRole('button', { name: 'Suurenda' }));
  expect(useViewStore.getState().boardView).toEqual({ zoom: 1.25, pan: { x: -100, y: -75 } });
});

async function nextCursorFrame() {
  // MutationObserver notifications arrive after the actual SVG transform commit.
  await act(async () => {
    await Promise.resolve();
  });
  act(() => vi.advanceTimersToNextFrame());
}
function stationaryPointer(svg: Element) {
  const event = new MouseEvent('pointermove', { bubbles: true, clientX: 217, clientY: 229 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  fireEvent(svg, event);
}

test('stationary_cursor_refreshes_after_center_zoom_fit_and_saved_view_change', async () => {
  vi.useFakeTimers();
  const { svg } = setup('none');
  stationaryPointer(svg);
  await nextCursorFrame();
  expect(screen.getByText('X 10,0 mm \u00b7 Y 10,0 mm')).toBeTruthy();
  // Keyboard activation emits a click without moving the pointer away from the canvas.
  screen.getByRole('button', { name: 'Suurenda' }).focus();
  fireEvent.click(screen.getByRole('button', { name: 'Suurenda' }), { detail: 0 });
  await nextCursorFrame();
  expect(screen.getByText('X 16,0 mm \u00b7 Y 14,0 mm')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sobita' }), { detail: 0 });
  await nextCursorFrame();
  expect(screen.getByText('X -61,1 mm \u00b7 Y 25,9 mm')).toBeTruthy();
  act(() => useViewStore.getState().setBoardView({ zoom: 2, pan: { x: 0, y: 0 } }));
  await nextCursorFrame();
  expect(screen.getByText('X 5,0 mm \u00b7 Y 5,0 mm')).toBeTruthy();
});

test('stationary_cursor_refreshes_after_scene_rotation_mirror_and_undo', async () => {
  vi.useFakeTimers();
  const { svg, transform } = setup('none');
  stationaryPointer(svg);
  await nextCursorFrame();
  act(() => transform('rot90'));
  await nextCursorFrame();
  expect(screen.getByText('X 10,0 mm \u00b7 Y 190,0 mm')).toBeTruthy();
  act(() => transform('mirror'));
  await nextCursorFrame();
  expect(screen.getByText('X 90,0 mm \u00b7 Y 10,0 mm')).toBeTruthy();
  act(() => transform('none'));
  await nextCursorFrame();
  expect(screen.getByText('X 10,0 mm \u00b7 Y 10,0 mm')).toBeTruthy();
});

test('stationary_cursor_refreshes_from_resized_root_ctm_and_clears_retained_point', async () => {
  vi.useFakeTimers();
  const { svg, viewport, engine } = setup('none');
  stationaryPointer(svg);
  await nextCursorFrame();
  const commits = canvasCommits.mock.calls.length;
  const renders = vi.mocked(layers[0]!.render).mock.calls.length;
  act(() => viewport([1, 0, 0, 1, 17, 29]));
  await nextCursorFrame();
  expect(screen.getByText('X 20,0 mm \u00b7 Y 20,0 mm')).toBeTruthy();
  expect(canvasCommits).toHaveBeenCalledTimes(commits);
  expect(vi.mocked(layers[0]!.render)).toHaveBeenCalledTimes(renders);
  act(() =>
    viewport([1, 0, 0, 1, 17, 29], {
      left: 300,
      top: 29,
      right: 1617,
      bottom: 1229,
      width: 1317,
      height: 1200,
    }),
  );
  await nextCursorFrame();
  expect(screen.getByText('X \u2014 \u00b7 Y \u2014')).toBeTruthy();
  act(() =>
    viewport([1, 0, 0, 1, 17, 29], {
      left: 17,
      top: 29,
      right: 1617,
      bottom: 1229,
      width: 1600,
      height: 1200,
    }),
  );
  await nextCursorFrame();
  expect(screen.getByText('X \u2014 \u00b7 Y \u2014')).toBeTruthy();
  stationaryPointer(svg);
  await nextCursorFrame();
  act(() => engine.replace(snapshot('next-session')));
  act(() => viewport([2, 0, 0, 2, 17, 29]));
  await nextCursorFrame();
  expect(screen.getByText('X \u2014 \u00b7 Y \u2014')).toBeTruthy();
});

test('resize_observer_refreshes_stationary_cursor_and_disconnects_on_unmount', async () => {
  vi.useFakeTimers();
  let notifyResize = () => {};
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notifyResize = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  try {
    const { svg, viewport, unmount } = setup('none');
    expect(observe).toHaveBeenCalledWith(svg);
    stationaryPointer(svg);
    await nextCursorFrame();
    act(() => {
      viewport([1, 0, 0, 1, 17, 29], undefined, false);
      notifyResize();
    });
    await nextCursorFrame();
    expect(screen.getByText('X 20,0 mm \u00b7 Y 20,0 mm')).toBeTruthy();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    act(() => notifyResize());
    await nextCursorFrame();
    expect(useCursorStore.getState().world).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
