export interface Point {
  x: number;
  y: number;
}

export interface PixelCheck {
  expected: Point;
  measured: Point | null;
  delta: Point | null;
  ok: boolean;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface MarkerExpectations {
  photoOnly: ImageData;
  red: Point;
  blue: Point;
  components: Record<string, Point>;
}

export interface MarkerChecks {
  red: PixelCheck;
  blue: PixelCheck;
  components: Record<string, PixelCheck>;
}

interface Mask {
  count: number;
  sumX: number;
  sumY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function mask(): Mask {
  return { count: 0, sumX: 0, sumY: 0, minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 };
}

function include(mask: Mask, x: number, y: number) {
  mask.count++;
  mask.sumX += x;
  mask.sumY += y;
  mask.minX = Math.min(mask.minX, x);
  mask.minY = Math.min(mask.minY, y);
  mask.maxX = Math.max(mask.maxX, x);
  mask.maxY = Math.max(mask.maxY, y);
}

function measurement(mask: Mask, expected: Point, tolerance: number): PixelCheck {
  const measured = mask.count ? { x: mask.sumX / mask.count, y: mask.sumY / mask.count } : null;
  const delta = measured ? { x: measured.x - expected.x, y: measured.y - expected.y } : null;
  return {
    expected,
    measured,
    delta,
    ok: delta !== null && Math.abs(delta.x) <= tolerance && Math.abs(delta.y) <= tolerance,
  };
}

function photoCheck(mask: Mask, expected: Point, corner: Point, bottomRight: boolean): PixelCheck {
  const check = measurement(mask, expected, 4);
  if (!mask.count) return check;
  const { minX, minY, maxX, maxY } = mask;
  const x = bottomRight ? maxX : minX;
  const y = bottomRight ? maxY : minY;
  return {
    ...check,
    bounds: { minX, minY, maxX, maxY },
    ok: check.ok && Math.abs(x - corner.x) <= 4 && Math.abs(y - corner.y) <= 4,
  };
}

/** Measure zero-based pixel centers, using binary masks rather than sampled colors. */
export function checkMarkers(png: ImageData, expect: MarkerExpectations): MarkerChecks {
  const red = mask();
  const blue = mask();
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i]!;
      const g = png.data[i + 1]!;
      const b = png.data[i + 2]!;
      if (r > 200 && g < 60 && b < 60) include(red, x, y);
      if (b > 200 && r < 60 && g < 60) include(blue, x, y);
    }
  }
  const components = Object.fromEntries(
    Object.entries(expect.components).map(([id, point]) => {
      const changed = mask();
      if (expect.photoOnly.width === png.width && expect.photoOnly.height === png.height) {
        const minX = Math.max(0, Math.ceil(point.x - 150));
        const minY = Math.max(0, Math.ceil(point.y - 150));
        const maxX = Math.min(png.width, Math.ceil(point.x + 150));
        const maxY = Math.min(png.height, Math.ceil(point.y + 150));
        for (let y = minY; y < maxY; y++) {
          for (let x = minX; x < maxX; x++) {
            const i = (y * png.width + x) * 4;
            if (
              png.data[i] !== expect.photoOnly.data[i] ||
              png.data[i + 1] !== expect.photoOnly.data[i + 1] ||
              png.data[i + 2] !== expect.photoOnly.data[i + 2] ||
              png.data[i + 3] !== expect.photoOnly.data[i + 3]
            ) {
              include(changed, x, y);
            }
          }
        }
      }
      return [id, measurement(changed, point, 2)];
    }),
  );
  return {
    red: photoCheck(red, expect.red, { x: 0, y: 0 }, false),
    blue: photoCheck(blue, expect.blue, { x: png.width - 1, y: png.height - 1 }, true),
    components,
  };
}
