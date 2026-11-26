import { assert, expect, test } from 'vitest';
import type { Vec2 } from '../model/primitives';
import { bodyLocalMarks, footprintBodyMarks, footprintBodyShape, footprintGeometry } from './index';
import type { FootprintParams } from './types';

function marks(footprint: string, params: FootprintParams = {}) {
  const geometry = footprintGeometry(footprint, params);
  assert(geometry);
  return bodyLocalMarks(geometry, footprintBodyShape(footprint), footprintBodyMarks(footprint));
}

function rounded(lines: Vec2[][]): number[][][] {
  return lines.map((line) => line.map(({ x, y }) => [Number(x.toFixed(6)), Number(y.toFixed(6))]));
}

function expectMarkedBox(
  result: ReturnType<typeof marks>,
  kind: 'band' | 'tab',
  [left, right]: [number, number],
  [top, bottom]: [number, number],
) {
  expect(result).toHaveLength(1);
  const [mark] = result;
  assert(mark);
  expect(mark).toMatchObject({ kind, filled: true });
  const [polygon] = rounded(mark.lines);
  expect(mark.lines).toHaveLength(1);
  expect(polygon).toHaveLength(4);
  expect(polygon).toEqual(
    expect.arrayContaining([
      [left, top],
      [right, top],
      [left, bottom],
      [right, bottom],
    ]),
  );
}

test('body_marks_follow_polarity_pins', () => {
  const result = marks('radial', { D: 6.3, pitch: 2.5 });
  expect(result.map(({ kind }) => kind)).toEqual(['plus', 'band']);
  const [plus, band] = result;
  assert(plus && band);
  expect(plus.filled).toBe(false);
  expect(rounded(plus.lines)).toEqual([
    [
      [-2.205, -1.575],
      [-0.945, -1.575],
    ],
    [
      [-1.575, -2.205],
      [-1.575, -0.945],
    ],
  ]);
  expect(band.filled).toBe(true);
  expect(band.lines).toHaveLength(1);
  const [polygon] = band.lines;
  assert(polygon);
  expect(polygon).toHaveLength(15);
  for (const { x, y } of polygon) {
    expect(x).toBeGreaterThanOrEqual(2.205 - 1e-10);
    expect(Math.hypot(x, y)).toBeLessThanOrEqual(3.15 + 1e-10);
  }
  const edge = polygon.filter(({ x }) => Math.abs(x - 2.205) < 1e-10);
  expect(edge).toHaveLength(2);
  for (const { y } of edge) expect(Math.abs(Math.abs(y) - 2.25)).toBeLessThanOrEqual(0.01);

  expectMarkedBox(marks('chip_tant', { case: 'B' }), 'band', [-1.75, -1.225], [-1.4, 1.4]);
  expectMarkedBox(marks('chip_diode', { case: 'SOD-123' }), 'band', [-1.35, -0.945], [-0.8, 0.8]);
  const axial = { pitch: 10.16, bl: 5.2, bd: 2.7 };
  expectMarkedBox(marks('axial', { ...axial, band: 'jah' }), 'band', [-2.6, -1.82], [-1.35, 1.35]);
  expect(marks('axial', { ...axial, band: 'ei' })).toEqual([]);
  expect(marks('led_tht', { D: 5 })).toEqual([]);
});

test('body_marks_notch_and_tab', () => {
  const soic = marks('soic', { pins: 8, body: 3.9 });
  expect(soic).toHaveLength(1);
  const [notch] = soic;
  assert(notch);
  expect(notch).toMatchObject({ kind: 'notch', filled: false });
  expect(notch.lines).toHaveLength(1);
  const [arc] = notch.lines;
  assert(arc);
  expect(arc).toHaveLength(13);
  const [points] = rounded([arc]);
  assert(points);
  expect(points[0]).toEqual([-0.65, -2.44]);
  expect(points[6]).toEqual([0, -1.79]);
  expect(points[12]).toEqual([0.65, -2.44]);
  for (const { x, y } of arc) expect(Math.hypot(x, y + 2.44)).toBeCloseTo(0.65, 10);

  const dip = marks('dip', { pins: 8, row: 7.62 });
  expect(dip).toHaveLength(1);
  const [dipNotch] = dip;
  assert(dipNotch);
  const [dipArc] = rounded(dipNotch.lines);
  assert(dipArc);
  expect(dipArc[0]).toEqual([-1, -5.23]);
  expect(dipArc[6]).toEqual([0, -4.23]);

  const qfp = marks('qfp', { pins: 44, pitch: 0.8 });
  expect(qfp).toHaveLength(1);
  const [corner] = qfp;
  assert(corner);
  expect(corner).toMatchObject({ kind: 'notch', filled: false });
  expect(rounded(corner.lines)).toEqual([
    [
      [-4, -5],
      [-5, -4],
    ],
  ]);
  expectMarkedBox(marks('to220'), 'tab', [-5.1, 5.1], [-2.3, -1]);
  expect(marks('chip', { size: '0805' })).toEqual([]);
});
