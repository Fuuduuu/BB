// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { cloneExportSvg, exportFailureStatus } from './png-svg';

test('PNG clone exports scene geometry independently of view and removes interaction overlays', () => {
  document.body.innerHTML =
    '<svg><g data-view transform="matrix(7 0 0 7 123 456)"><g data-scene transform="matrix(1 0 0 1 0 0)"><rect width="4000" height="3000"/><image data-layer="photo.image" href="http://pcbk.localhost/photo/test?v=display"/><g data-layer="components.bodies"><polygon fill="red"/></g><g data-layer="components.labels"><text font-family="monospace">R1</text></g><g data-layer="photo.calibration"/><g data-selection/><g data-tool-overlay/></g></g></svg>';
  const original = document.querySelector('svg')!;
  const overlayRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  overlayRect.setAttribute('data-tool-rectangle', '');
  original.querySelector('[data-scene]')!.append(overlayRect);
  const cloned = cloneExportSvg(original, [0, 1, -1, 0, 3000, 0], 3000, 4000, true);
  expect(cloned.getAttribute('viewBox')).toBe('0 0 3000 4000');
  expect(cloned.querySelector('[data-view]')).toBeNull();
  expect(cloned.querySelector('[data-scene]')?.getAttribute('transform')).toBe(
    'matrix(0 1 -1 0 3000 0)',
  );
  expect(cloned.querySelectorAll('image')).toHaveLength(1);
  expect(cloned.querySelector('image')?.getAttribute('href')).toContain('http://pcbk.localhost');
  expect(
    cloned.querySelectorAll(
      '[data-selection], [data-tool-overlay], [data-layer="photo.calibration"]',
    ),
  ).toHaveLength(0);
  expect(cloned.querySelector('text')?.textContent).toBe('R1');
  expect(cloned.querySelector('[data-tool-rectangle]')).toBeNull();
  expect(original.querySelector('[data-view]')?.getAttribute('transform')).toContain('123');
  const layers = cloneExportSvg(original, [1, 0, 0, 1, 0, 0], 4000, 3000, false);
  expect(layers.querySelector('image')).toBeNull();
  expect(layers.querySelector('[data-scene] > rect')).toBeNull();
});

test('canvas security failures stay distinct from decode and other export failures', () => {
  expect(exportFailureStatus(new DOMException('tainted canvas', 'SecurityError'))).toBe('tainted');
  expect(exportFailureStatus(new Error('image load failed'))).toBe('error:image load failed');
});
