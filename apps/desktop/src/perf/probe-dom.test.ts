// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { canvasCounts, formatResult, trackForeground } from './probe-dom';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

test('canvas readiness counts bodies separately from duplicate pin and label groups', () => {
  document.body.innerHTML =
    '<svg><g data-layer="components.bodies"><g data-component="a"><polygon /></g></g><g data-layer="components.pins"><g data-component="a"><g data-pin="1" /></g></g><g data-layer="components.labels"><text>R1</text><text>1</text></g><image data-layer="photo.image" /></svg>';
  expect(canvasCounts(document.querySelector('svg')!)).toMatchObject({
    bodies: 1,
    pins: 1,
    labels: 2,
    photos: 1,
  });
});

test('a transient loss of foreground invalidates the whole measurement', () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  const foreground = trackForeground();
  expect(foreground.reasons()).toEqual([]);
  window.dispatchEvent(new Event('blur'));
  window.dispatchEvent(new Event('focus'));
  expect(foreground.reasons()).toEqual(['window_blurred']);
  foreground.stop();
});

test('hidden visibility is retained even after the window becomes visible', () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const foreground = trackForeground();
  visibility.mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  visibility.mockReturnValue('visible');
  expect(foreground.reasons()).toEqual(['window_hidden']);
  foreground.stop();
});

test('result table reports budgets and marks invalid measurements instead of passing them', () => {
  const result = {
    valid: true,
    creationMs: 5000,
    open: { medianMs: 1400, budgetMs: 1500 },
    pan: { fps: 59, budgetFps: 60 },
    zoom: { fps: 60, budgetFps: 60 },
    drag: { fps: 44, budgetFps: 45 },
  };
  const table = formatResult(result);
  expect(table).toMatch(/Mõõdik\s+Tulemus\s+Eelarve\s+Kas peab/);
  expect(table).toMatch(/Avamine\s+1400\.0 ms\s+< 1500 ms\s+Jah/);
  expect(table).toMatch(/Pan\s+59\.0 fps\s+≥ 60 fps\s+Ei/);
  expect(table).toMatch(/Suum\s+60\.0 fps\s+≥ 60 fps\s+Jah/);
  expect(table).toMatch(/Lohistamine\s+44\.0 fps\s+≥ 45 fps\s+Ei/);
  expect(table).toContain('Loomine: 5000.0 ms (eelarveta)');
  const invalid = formatResult({ ...result, valid: false, invalidReasons: ['window_hidden'] });
  expect(invalid).toContain('KEHTETU');
  expect(invalid).toContain('window_hidden');
  expect(invalid).not.toMatch(/\sJah(?:\s|$)/);
});
