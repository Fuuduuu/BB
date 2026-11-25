import { assert, expect, test } from 'vitest';
import { bodyOutline } from '../geometry/board';
import { bodyLocalOutline, footprintBodyShape, footprintGeometry } from './index';
import type { FootprintParams } from './types';

const tolerance = 1e-8;

function localOutline(footprint: string, params: FootprintParams = {}) {
  const geometry = footprintGeometry(footprint, params);
  assert(geometry);
  return bodyLocalOutline(geometry.body, footprintBodyShape(footprint));
}

test('body_outline_follows_footprint_shape', () => {
  const center = { x: 100, y: 50 };
  const placed = bodyOutline(
    {
      footprint: 'radial',
      params: { D: 6.3 },
      center,
      rotationDeg: 30,
      side: 'bottom',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    },
    10,
  );
  expect(placed).toHaveLength(48);
  for (const { x, y } of placed) {
    expect(Math.hypot(x - center.x, y - center.y)).toBeCloseTo(31.5, 8);
  }

  expect(localOutline('chip', { size: '0805' })).toEqual([
    { x: -1, y: -0.625 },
    { x: 1, y: -0.625 },
    { x: 1, y: 0.625 },
    { x: -1, y: 0.625 },
  ]);

  const radial = localOutline('radial', { D: 6.3 });
  expect(radial).toHaveLength(48);
  expect(radial[0]).toEqual({ x: 3.15, y: 0 });
  for (const { x, y } of radial) expect(Math.hypot(x, y)).toBeCloseTo(3.15, 8);

  const disc = localOutline('disc', { pitch: 5.08 });
  expect(disc).toHaveLength(50);
  for (const { x, y } of disc) {
    const absX = Math.abs(x);
    expect(absX).toBeLessThanOrEqual(3.64 + tolerance);
    expect(Math.abs(y)).toBeLessThanOrEqual(1.3 + tolerance);
    if (absX <= 2.34 + tolerance) {
      expect(Math.abs(y)).toBeCloseTo(1.3, 8);
    } else {
      expect(Math.hypot(absX - 2.34, y)).toBeCloseTo(1.3, 8);
    }
  }

  const led = localOutline('led_tht', { D: 5 });
  expect(led).toHaveLength(49);
  const ledFlat = led.filter(({ x }) => Math.abs(x + 2.697) < tolerance);
  expect(ledFlat).toHaveLength(2);
  expect(Math.min(...ledFlat.map(({ y }) => y))).toBeCloseTo(-1.48, 3);
  expect(Math.max(...ledFlat.map(({ y }) => y))).toBeCloseTo(1.48, 3);
  for (const { x, y } of led) {
    expect(Math.abs(x)).toBeLessThanOrEqual(2.697 + tolerance);
    expect(Math.abs(y)).toBeLessThanOrEqual(2.9 + tolerance);
    expect(Math.hypot(x + 0.203, y)).toBeCloseTo(2.9, 8);
  }

  const transistor = localOutline('to92');
  expect(transistor).toHaveLength(49);
  const transistorFlat = transistor.filter(({ y }) => Math.abs(y - 2) < tolerance);
  expect(transistorFlat).toHaveLength(2);
  expect(Math.min(...transistorFlat.map(({ x }) => x))).toBeCloseTo(-1.789, 3);
  expect(Math.max(...transistorFlat.map(({ x }) => x))).toBeCloseTo(1.789, 3);
  for (const { x, y } of transistor) {
    expect(Math.abs(x)).toBeLessThanOrEqual(2.4 + tolerance);
    expect(Math.abs(y)).toBeLessThanOrEqual(2 + tolerance);
    expect(Math.hypot(x, y - 0.4)).toBeCloseTo(2.4, 8);
  }
});

test('footprint_body_shapes_by_family', () => {
  for (const key of ['radial', 'el_smd'])
    expect(footprintBodyShape(key)).toEqual({ shape: 'circle' });
  for (const key of ['disc', 'xtal']) expect(footprintBodyShape(key)).toEqual({ shape: 'oval' });
  expect(footprintBodyShape('led_tht')).toEqual({ shape: 'd', flat: '-x' });
  expect(footprintBodyShape('to92')).toEqual({ shape: 'd', flat: '+y' });
  for (const key of ['chip', 'axial', 'soic', 'unknown']) {
    expect(footprintBodyShape(key)).toEqual({ shape: 'rect' });
  }
});
