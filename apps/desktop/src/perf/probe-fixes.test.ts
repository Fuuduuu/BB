// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FOOTPRINTS, newBoardDoc } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { engineFeatures, RESERVED_FIELDS } from '@pcbk/features/engine';
import { createComponentsUi } from '@pcbk/features/components/ui';
import * as probe from './probe';
import { generateSyntheticBoard } from './synthetic-board';
import { awaitProbeReady, failureResult, selectDenseTarget } from './probe-setup';
import { observeSvgPhoto } from './probe-dom';
import { requireBodySelection } from './probe-input';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function photo() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = '<image data-layer="photo.image" width="4000" height="3000" />';
  document.body.append(svg);
  return { svg, image: svg.querySelector('image')! };
}

test('probe centres the target in the fixed viewport rather than the padded SVG', () => {
  const viewport = document.createElement('div');
  const { svg } = photo();
  viewport.append(svg);
  Object.defineProperties(viewport, {
    clientWidth: { value: 800 },
    clientHeight: { value: 600 },
  });
  Object.defineProperties(svg, {
    clientWidth: { value: 1200 },
    clientHeight: { value: 900 },
  });
  expect(probe.probeViewportCenter(svg)).toEqual({ x: 400, y: 300 });
});

test('opening observes the displayed SVG photo load before readiness and rejects unrelated nodes', () => {
  const observer = observeSvgPhoto();
  const unrelated = photo();
  const current = photo();
  unrelated.image.dispatchEvent(new Event('load'));
  expect(observer.ready(current.svg)).toBe(false);
  current.image.dispatchEvent(new Event('load'));
  expect(observer.ready(current.svg)).toBe(true);
  current.image.remove();
  current.svg.innerHTML = '<image data-layer="photo.image" width="4000" height="3000" />';
  expect(observer.ready(current.svg)).toBe(false);
  observer.stop();
  current.svg.querySelector('image')!.dispatchEvent(new Event('load'));
  expect(observer.ready(current.svg)).toBe(false);
});

test('opening reports an error from its actual SVG photo', () => {
  const observer = observeSvgPhoto();
  const current = photo();
  current.image.dispatchEvent(new Event('error'));
  expect(() => observer.ready(current.svg)).toThrow('SVG photo load failed');
  observer.stop();
});

test('dense target is the nearest central SOIC rather than a corner or a pin-filled header', () => {
  const components = [
    { id: 'corner', kind: 'ic', board: { footprint: 'soic', center: { x: 100, y: 100 } } },
    {
      id: 'header',
      kind: 'connector',
      board: { footprint: 'header1', center: { x: 2000, y: 1500 } },
    },
    { id: 'central', kind: 'ic', board: { footprint: 'soic', center: { x: 2100, y: 1500 } } },
  ];
  expect(selectDenseTarget(components, { width: 4000, height: 3000 })?.id).toBe('central');
  expect(components[0]?.id).toBe('corner');
});

test('body hit requires exactly one component selected by pointerdown', () => {
  expect(() => requireBodySelection([], 'central')).toThrow();
  expect(() =>
    requireBodySelection([{ kind: 'pin', id: '1', componentId: 'central' }], 'central'),
  ).toThrow();
  expect(() =>
    requireBodySelection(
      [
        { kind: 'component', id: 'central' },
        { kind: 'component', id: 'corner' },
      ],
      'central',
    ),
  ).toThrow();
  expect(() =>
    requireBodySelection([{ kind: 'component', id: 'central' }], 'central'),
  ).not.toThrow();
});

test('initial no-focus timeout becomes structured invalid result with environment', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hasFocus').mockReturnValue(false);
  const result = awaitProbeReady(() => true, 40, 40).catch((error: unknown) =>
    failureResult(error),
  );
  await vi.advanceTimersByTimeAsync(60);
  expect(await result).toMatchObject({
    valid: false,
    invalidReasons: ['foreground_timeout', 'window_not_focused'],
    hasFocus: false,
    visibilityState: 'visible',
  });
});

test('initial hidden timeout and missing Home produce distinct structured reasons', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const hidden = awaitProbeReady(() => true, 40, 40).catch((error: unknown) =>
    failureResult(error),
  );
  await vi.advanceTimersByTimeAsync(60);
  expect(await hidden).toMatchObject({
    valid: false,
    invalidReasons: ['foreground_timeout', 'window_hidden'],
    visibilityState: 'hidden',
  });
  visibility.mockReturnValue('visible');
  const home = awaitProbeReady(() => false, 40, 40).catch((error: unknown) => failureResult(error));
  await vi.advanceTimersByTimeAsync(60);
  expect(await home).toMatchObject({ valid: false, invalidReasons: ['home_timeout'] });
});

test('focus can recover before initial deadline without invalidating the later measurement', async () => {
  vi.useFakeTimers();
  const focus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
  let settled = false;
  const ready = awaitProbeReady(() => true, 100, 40).then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(20);
  expect(settled).toBe(false);
  focus.mockReturnValue(true);
  await vi.advanceTimersByTimeAsync(20);
  await expect(ready).resolves.toBeUndefined();
});

test('probe base zoom keeps every actual pad number visible throughout the zoom wave', () => {
  let sequence = 0;
  const ids = { newId: (prefix: string) => `${prefix}_${++sequence}` };
  const at = '2026-01-01T00:00:00.000Z';
  const synthetic = generateSyntheticBoard({ seed: 127, ids, at });
  const components = synthetic.components.map(({ ref, board, ...component }) => {
    if (!ref || !board) throw new Error('Expected a placed synthetic component with a reference');
    const defaults = FOOTPRINTS.find((footprint) => footprint.key === board.footprint)?.defaults;
    return {
      ...component,
      ref,
      marking: component.marking ?? '',
      value: component.value ?? '',
      identified: false,
      dnp: false,
      note: '',
      pins: component.pins.map((pin) => ({ ...pin, nc: false })),
      board: {
        ...board,
        params: { ...defaults, ...board.params },
        rotationDeg: board.rotationDeg ?? 0,
        side: board.side ?? 'top',
        scaleX: 1,
        scaleY: 1,
        customPads: {},
      },
    };
  });
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => at },
  });
  host.load('probe-base-zoom', { ...newBoardDoc('Proov'), components }, false);
  const snapshot = engine.snapshot();
  const zoom = probe.probeBaseZoom(snapshot.doc);
  const labels = createComponentsUi(ids).canvasLayers!.find(
    (layer) => layer.id === 'components.labels',
  )!;
  const rendered = document.createElement('div');
  rendered.innerHTML = renderToStaticMarkup(
    createElement('svg', {}, labels.render({ snapshot, preview: null, zoom: zoom * 0.85 })),
  );
  expect(rendered.querySelectorAll('text'), 'all pad numbers at zoom factor 0.85').toHaveLength(
    3300,
  );
});

test.each([
  [
    'the first post-gesture frame',
    [300, ...Array.from({ length: 44 }, (_, index) => 316 + index * 16)],
  ],
  [
    'the delayed LOD redraw',
    [
      16,
      32,
      48,
      64,
      80,
      96,
      112,
      128,
      428,
      ...Array.from({ length: 36 }, (_, index) => 444 + index * 16),
    ],
  ],
] as const)(
  'settle measurement includes %s without adding it to gesture fps',
  async (_, timestamps) => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    let index = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const timestamp = timestamps[index++];
      if (timestamp === undefined)
        throw new Error('Settle sampler exceeded the observation window');
      queueMicrotask(() => callback(timestamp));
      return index;
    });
    expect(await probe.measureZoomSettle()).toEqual({
      windowMs: 1000,
      elapsedMs: 1004,
      frames: 45,
      worstMs: 300,
    });
  },
);
