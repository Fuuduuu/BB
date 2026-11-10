import { expect, test } from 'vitest';
import { FOOTPRINTS, footprintGeometry, footprintPinIds } from '../index';
import type { FootprintParams } from '../index';

test('soic8_pin1_and_pin8_positions', () => {
  const geometry = footprintGeometry('soic', {});
  expect(geometry?.pads[0]).toStrictEqual({
    id: '1',
    x: -2.775,
    y: -1.905,
    w: 1.55,
    h: 0.6,
    shape: 'rect',
    through: false,
  });
  expect(geometry?.pads[7]).toMatchObject({ id: '8', x: 2.775, y: -1.905 });
  expect(geometry?.body).toStrictEqual({ w: 3.9, h: 4.88, pin1: { x: -1.35, y: -1.84 } });
});

test('soic_14_has_14_pads_numbered_1_to_14', () => {
  const ids = Array.from({ length: 14 }, (_, index) => String(index + 1));
  const geometry = footprintGeometry('soic', { pins: 14 });
  expect(geometry?.pads.map(({ id }) => id)).toEqual(ids);
  expect(footprintPinIds('soic', { pins: 14 })).toEqual(ids);
  expect(geometry?.pads[6]).toMatchObject({ id: '7', x: -2.775, y: 3.81 });
  expect(geometry?.pads[7]).toMatchObject({ id: '8', x: 2.775, y: 3.81 });
});

test('chip_0805_has_two_pads_symmetric_about_origin', () => {
  expect(footprintGeometry('chip', {})).toStrictEqual({
    pads: [
      { id: '1', x: -1, y: 0, w: 1, h: 1.35, shape: 'rect', through: false },
      { id: '2', x: 1, y: 0, w: 1, h: 1.35, shape: 'rect', through: false },
    ],
    body: { w: 2, h: 1.25 },
  });
});

test('chip sizes use their individual pad and body dimensions', () => {
  const sizes = [
    ['0402', 0.5, 0.6, 0.6, 1, 0.5],
    ['0603', 0.8, 0.8, 0.95, 1.6, 0.8],
    ['0805', 1, 1, 1.35, 2, 1.25],
    ['1206', 1.5, 1.15, 1.8, 3.2, 1.6],
    ['1210', 1.5, 1.15, 2.7, 3.2, 2.5],
    ['2010', 2.4, 1.3, 2.6, 5, 2.5],
    ['2512', 2.95, 1.5, 3.4, 6.3, 3.2],
  ] as const;
  for (const [size, c, w, h, bodyWidth, bodyHeight] of sizes) {
    const geometry = footprintGeometry('chip', { size });
    expect(geometry?.body, size).toStrictEqual({ w: bodyWidth, h: bodyHeight });
    expect(geometry?.pads, size).toStrictEqual([
      { id: '1', x: -c, y: 0, w, h, shape: 'rect', through: false },
      { id: '2', x: c, y: 0, w, h, shape: 'rect', through: false },
    ]);
  }
});

test('sot23_3_5_6_pin_counts', () => {
  const variants = [
    {
      points: [
        [-0.95, 1],
        [0.95, 1],
        [0, -1],
      ],
      h: 1.3,
      markerY: 0.3,
    },
    {
      points: [
        [-0.95, 1.1],
        [0, 1.1],
        [0.95, 1.1],
        [0.95, -1.1],
        [-0.95, -1.1],
      ],
      h: 1.6,
      markerY: 0.45,
    },
    {
      points: [
        [-0.95, 1.1],
        [0, 1.1],
        [0.95, 1.1],
        [0.95, -1.1],
        [0, -1.1],
        [-0.95, -1.1],
      ],
      h: 1.6,
      markerY: 0.45,
    },
  ];
  for (const { points, h, markerY } of variants) {
    const geometry = footprintGeometry('sot23', { pins: points.length });
    expect(geometry?.pads).toStrictEqual(
      points.map(([x, y], index) => ({
        id: String(index + 1),
        x,
        y,
        w: 0.6,
        h: 0.8,
        shape: 'rect',
        through: false,
      })),
    );
    expect(geometry?.body).toStrictEqual({ w: 2.9, h, pin1: { x: -1.05, y: markerY } });
  }
});

test('to220_has_three_pads', () => {
  expect(footprintGeometry('to220', {})).toStrictEqual({
    pads: [-2.54, 0, 2.54].map((x, index) => ({
      id: String(index + 1),
      x,
      y: 1.1,
      w: 1.9,
      h: 2.6,
      shape: 'rect',
      through: true,
    })),
    body: { w: 10.2, h: 4.6 },
  });
});

test('header1_pitch_254_places_pads_every_2_54_mm', () => {
  expect(footprintGeometry('header1', {})).toStrictEqual({
    pads: [-3.81, -1.27, 1.27, 3.81].map((x, index) => ({
      id: String(index + 1),
      x,
      y: 0,
      w: 1.727,
      h: 1.727,
      shape: index === 0 ? 'rect' : 'circle',
      through: true,
    })),
    body: { w: 10.16, h: 2.54 },
  });
});

test('area_has_no_pads', () => {
  expect(footprintGeometry('area', {})).toStrictEqual({ pads: [], body: { w: 8, h: 10 } });
  expect(footprintGeometry('area', { w: 6.5 })).toStrictEqual({
    pads: [],
    body: { w: 6.5, h: 10 },
  });
  expect(footprintPinIds('area', {})).toEqual([]);
});

test('unknown_footprint_or_invalid_params_returns_undefined', () => {
  const cases: [string, FootprintParams][] = [
    ['unknown', {}],
    ['constructor', {}],
    ['chip', { size: 805 }],
    ['chip', { size: '805' }],
    ['chip', { size: ' 0805' }],
    ['sot23', { pins: 4 }],
    ['sot23', { pins: '3e0' }],
    ['soic', { pins: 9 }],
    ['soic', { body: 7.6 }],
    ['soic', { body: '3,9' }],
    ['soic', { pitch: 1.27 }],
    ['to220', { pins: 3 }],
    ['header1', { pins: 0 }],
    ['header1', { pins: 41 }],
    ['header1', { pins: 2.5 }],
    ['header1', { pins: '0x04' }],
    ['header1', { pitch: 2.5 }],
    ['area', { w: '' }],
    ['area', { h: '   ' }],
    ['area', { h: 0 }],
    ['area', { h: -2 }],
    ['area', { w: Infinity }],
    ['area', { h: NaN }],
  ];
  for (const [key, params] of cases) {
    expect(footprintGeometry(key, params), key).toBeUndefined();
    expect(footprintPinIds(key, params), key).toBeUndefined();
  }
});

test('the public footprint registry exposes the ordered keys, names and defaults', () => {
  expect(FOOTPRINTS.map(({ key, name, defaults }) => [key, name, defaults])).toStrictEqual([
    ['chip', 'Chip', { size: '0805' }],
    ['sot23', 'SOT-23', { pins: 3 }],
    ['soic', 'SOIC', { pins: 8, body: 3.9 }],
    ['to220', 'TO-220', {}],
    ['header1', '1×N', { pins: 4, pitch: 2.54 }],
    ['area', 'Area', { w: 8, h: 10 }],
  ]);
  for (const { key, defaults, gen } of FOOTPRINTS) {
    const geometry = footprintGeometry(key, {});
    expect(geometry, key).toBeDefined();
    expect(gen(defaults), key).toEqual(geometry);
    expect(gen({ ...defaults, extra: 1 }), key).toBeUndefined();
    if (Object.keys(defaults).length) expect(gen({}), key).toBeUndefined();
  }
});

test('numeric footprint parameters accept decimal strings and supported boundaries', () => {
  const wide = footprintGeometry('soic', { pins: '28', body: '7.5' });
  expect(wide?.pads).toHaveLength(28);
  expect(wide?.pads[27]).toMatchObject({ id: '28', x: 4.575, y: -8.255 });
  expect(footprintGeometry('sot23', { pins: '5' })).toEqual(
    footprintGeometry('sot23', { pins: 5 }),
  );
  expect(footprintGeometry('header1', { pins: '1', pitch: '1.27' })?.pads[0]).toMatchObject({
    x: 0,
    y: 0,
    w: 0.864,
    h: 0.864,
  });
  expect(footprintPinIds('header1', { pins: '40', pitch: '2' })).toEqual(
    Array.from({ length: 40 }, (_, index) => String(index + 1)),
  );
  expect(footprintGeometry('area', { w: '3.5', h: '7.25' })?.body).toEqual({ w: 3.5, h: 7.25 });
});

test('footprint results are fresh and generating them leaves the parameters unchanged', () => {
  const params = Object.freeze({ pins: '14' });
  const first = footprintGeometry('soic', params);
  const second = footprintGeometry('soic', params);
  expect(first).toBeDefined();
  expect(first).toEqual(second);
  expect(first).not.toBe(second);
  expect(first?.pads).not.toBe(second?.pads);
  expect(first?.pads[0]).not.toBe(second?.pads[0]);
  expect(first?.body).not.toBe(second?.body);
  expect(first?.body.pin1).not.toBe(second?.body.pin1);
  expect(params).toEqual({ pins: '14' });
});
