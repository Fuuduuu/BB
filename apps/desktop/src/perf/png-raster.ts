type Size = { width: number; height: number };
export type BitmapToRaw = readonly [number, number, number, number, number, number];

export function photoRasterGeometry(raw: Size, natural: Size, exif: 1 | 6) {
  if (
    [raw.width, raw.height, natural.width, natural.height].some(
      (value) => !Number.isFinite(value) || value <= 0,
    )
  ) {
    throw new Error('Invalid photo raster dimensions');
  }
  // Detect axes from metadata, allowing a one-pixel display-variant rounding difference.
  const matches = (width: number, height: number) =>
    Math.abs(natural.width / width - natural.height / height) <= Math.max(1 / width, 1 / height);
  const rawAxes = matches(raw.width, raw.height);
  const orientedAxes = exif === 6 && matches(raw.height, raw.width);
  if (rawAxes && orientedAxes) throw new Error('Ambiguous EXIF6 bitmap axes');
  if (!rawAxes && !orientedAxes)
    throw new Error('Photo natural dimensions do not match raw or EXIF6 axes');
  const bitmapToRaw: BitmapToRaw = orientedAxes
    ? // Inverse clockwise EXIF6: raw x=bitmap y; raw y=raw H-bitmap x.
      [0, -raw.height / natural.width, raw.width / natural.height, 0, 0, raw.height]
    : [raw.width / natural.width, 0, 0, raw.height / natural.height, 0, 0];
  return {
    bitmapToRaw,
    bitmapCoordinates: orientedAxes ? 'exif6-oriented' : 'raw',
    rasterMethod: orientedAxes
      ? 'natural bitmap -> inverse EXIF6 -> raw photo -> layer exportMatrix'
      : 'natural bitmap -> raw photo axes -> layer exportMatrix',
  };
}
