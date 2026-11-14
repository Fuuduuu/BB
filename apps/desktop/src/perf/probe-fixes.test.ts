// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
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
