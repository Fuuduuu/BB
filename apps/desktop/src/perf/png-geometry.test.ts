import { expect, test } from 'vitest';
import type { PhotoRef } from '@pcbk/domain';
import { exportMatrix } from './png-geometry';

test('export_matrix_maps_photo_pixel_to_png_pixel_under_all_8_transforms', () => {
  const width = 137;
  const height = 83;
  // Hand-derived index formulas, independent of the production scene matrix.
  const expected: Record<PhotoRef['transform'], (x: number, y: number) => number[]> = {
    none: (x, y) => [x, y],
    rot90: (x, y) => [height - 1 - y, x],
    rot180: (x, y) => [width - 1 - x, height - 1 - y],
    rot270: (x, y) => [y, width - 1 - x],
    mirror: (x, y) => [width - 1 - x, y],
    mirror_rot90: (x, y) => [height - 1 - y, width - 1 - x],
    mirror_rot180: (x, y) => [x, height - 1 - y],
    mirror_rot270: (x, y) => [y, x],
  };
  for (const transform of Object.keys(expected) as PhotoRef['transform'][]) {
    for (const scale of [0.5, 1, 2.5]) {
      const [a, b, c, d, e, f] = exportMatrix(transform, { width, height }, scale);
      for (const [x, y] of [
        [11, 27],
        [87, 14],
      ] as const) {
        const [wantX, wantY] = expected[transform](x, y);
        expect(a * (x + 0.5) + c * (y + 0.5) + e - 0.5).toBeCloseTo(
          wantX! * scale + (scale - 1) / 2,
        );
        expect(b * (x + 0.5) + d * (y + 0.5) + f - 0.5).toBeCloseTo(
          wantY! * scale + (scale - 1) / 2,
        );
      }
    }
  }
});
