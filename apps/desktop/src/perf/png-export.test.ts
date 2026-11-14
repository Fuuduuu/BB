import { expect, test } from 'vitest';
import { p1PhotoEvidence } from './png-export';
import { checkMarkers } from './png-markers';

function testPixels(swap: boolean | null) {
  const width = 400,
    height = 300;
  const data = new Uint8ClampedArray(width * height * 4);
  if (swap !== null)
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) {
        data.set(swap ? [0, 0, 255, 255] : [255, 0, 0, 255], (y * width + x) * 4);
        data.set(swap ? [255, 0, 0, 255] : [0, 0, 255, 255], ((y + 260) * width + x + 360) * 4);
      }
  return { width, height, data } as ImageData;
}

test('P1 existing photo with swapped marker corners fails alignment without reporting missing photo', () => {
  const png = testPixels(true);
  const markers = checkMarkers(png, {
    photoOnly: png,
    red: { x: 19.5, y: 19.5 },
    blue: { x: 379.5, y: 279.5 },
    components: {},
  });
  expect(markers.red.measured).toEqual({ x: 379.5, y: 279.5 });
  expect(markers.red.ok).toBe(false);
  expect(markers.blue.ok).toBe(false);
  expect(p1PhotoEvidence(markers)).toMatchObject({
    status: 'ok',
    photoPresent: true,
    pixelChecksOk: false,
  });
});

test('P1 absent photo remains photo_missing', () => {
  const png = testPixels(null);
  const markers = checkMarkers(png, {
    photoOnly: png,
    red: { x: 19.5, y: 19.5 },
    blue: { x: 379.5, y: 279.5 },
    components: {},
  });
  expect(p1PhotoEvidence(markers)).toMatchObject({
    status: 'photo_missing',
    photoPresent: false,
    pixelChecksOk: false,
  });
});
