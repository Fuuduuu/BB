import { expect, test } from 'vitest';
import { pngProbeOptions } from './png-options';

test('PNG probe defaults retain both photos, variants and routes', () => {
  expect(pngProbeOptions()).toEqual({
    size: { width: 4000, height: 3000 },
    portraits: [false, true],
    variants: ['display', 'original'],
    routes: ['P1', 'P2-normal', 'P2-anonymous', 'P3'],
  });
});

test('48 MP PNG probe measures only P3 original at 8000x6000', () => {
  expect(pngProbeOptions('8000x6000')).toEqual({
    size: { width: 8000, height: 6000 },
    portraits: [false],
    variants: ['original'],
    routes: ['P3'],
  });
  expect(() => pngProbeOptions('8000x0')).toThrow();
});
