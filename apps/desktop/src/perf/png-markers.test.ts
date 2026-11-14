import { expect, test } from 'vitest';
import { checkMarkers } from './png-markers';

type Color = readonly [number, number, number, number];
const red = [220, 30, 25, 255] as const;
const blue = [25, 30, 220, 255] as const;

function image(): ImageData {
  return {
    width: 420,
    height: 350,
    colorSpace: 'srgb',
    data: new Uint8ClampedArray(420 * 350 * 4),
  } as ImageData;
}

function rect(png: ImageData, x: number, y: number, w: number, h: number, color: Color) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      png.data.set(color, (row * png.width + col) * 4);
    }
  }
}

function fixture(shift = 0) {
  const photoOnly = image();
  rect(photoOnly, 0, 0, 40, 40, red);
  rect(photoOnly, 380, 310, 40, 40, blue);
  const png = image();
  png.data.set(photoOnly.data);
  rect(png, 8, 14, 24, 12, [90, 90, 90, 255]);
  rect(png, 388, 324, 24, 12, [90, 90, 90, 255]);
  rect(png, 174 + shift, 110, 24, 12, [90, 90, 90, 255]);
  const expected = {
    photoOnly,
    red: { x: 19.5, y: 19.5 },
    blue: { x: 399.5, y: 329.5 },
    components: {
      resistor: { x: 19.5, y: 19.5 },
      soic: { x: 399.5, y: 329.5 },
      offAxis: { x: 185.5, y: 115.5 },
    },
  };
  return { png, expected };
}

test('marker_check_detects_corners_and_component_centers', () => {
  const { png, expected } = fixture();
  const result = checkMarkers(png, expected);
  for (const check of [result.red, result.blue, ...Object.values(result.components)]) {
    expect(check.ok).toBe(true);
    expect(check.measured).toEqual(check.expected);
    expect(check.delta).toEqual({ x: 0, y: 0 });
  }
  expect(result.red.bounds).toEqual({ minX: 0, minY: 0, maxX: 39, maxY: 39 });
  expect(result.blue.bounds).toEqual({ minX: 380, minY: 310, maxX: 419, maxY: 349 });
});

test('marker_check_fails_on_rotated_or_missing_photo', () => {
  const { expected } = fixture();
  const rotated = image();
  rect(rotated, 0, 0, 40, 40, blue);
  rect(rotated, 380, 310, 40, 40, red);
  const wrong = checkMarkers(rotated, expected);
  expect(wrong.red.ok).toBe(false);
  expect(wrong.blue.ok).toBe(false);
  expect(wrong.red.measured).toEqual({ x: 399.5, y: 329.5 });
  expect(wrong.red.delta).toEqual({ x: 380, y: 310 });
  const missing = checkMarkers(image(), { ...expected, photoOnly: image() });
  expect(missing.red).toMatchObject({ measured: null, delta: null, ok: false });
  expect(missing.blue).toMatchObject({ measured: null, delta: null, ok: false });
  expect(missing.components.offAxis).toMatchObject({ measured: null, delta: null, ok: false });
});

test('marker_check_rejects_8px_component_shift', () => {
  const { png, expected } = fixture(8);
  // The expected point remains inside the shifted 24px-wide body.
  const index = (115 * png.width + 185) * 4;
  expect(Array.from(png.data.slice(index, index + 4))).toEqual([90, 90, 90, 255]);
  const result = checkMarkers(png, expected);
  expect(result.components.offAxis).toEqual({
    expected: { x: 185.5, y: 115.5 },
    measured: { x: 193.5, y: 115.5 },
    delta: { x: 8, y: 0 },
    ok: false,
  });
});
