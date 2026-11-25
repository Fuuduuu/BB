import type { PhotoRef } from '@pcbk/domain';

export type CalibrationPhoto = Pick<PhotoRef, 'widthPx' | 'heightPx' | 'transform'>;
type PhotoDimensions = { width: number; height: number };

export type CalibrationPreview = {
  pxPerMm: number;
  umPerPx: number;
  photoMm?: PhotoDimensions;
};

export function parseCalibrationMm(input: string): number | null {
  const mm = Number(input.trim().replace(',', '.'));
  return Number.isFinite(mm) && mm > 0 && mm <= 1000 ? mm : null;
}

export function calibrationPhotoSize(
  { widthPx, heightPx, transform }: CalibrationPhoto,
  pxPerMm: number,
): PhotoDimensions {
  const rotatesQuarterTurn =
    transform === 'rot90' ||
    transform === 'rot270' ||
    transform === 'mirror_rot90' ||
    transform === 'mirror_rot270';
  return rotatesQuarterTurn
    ? { width: heightPx / pxPerMm, height: widthPx / pxPerMm }
    : { width: widthPx / pxPerMm, height: heightPx / pxPerMm };
}

export function formatCalibrationDimension(value: number): string {
  return value.toFixed(value >= 10 ? 0 : 1).replace('.', ',');
}

export function calibrationPreview({
  distancePx,
  input,
  photo,
}: {
  distancePx: number;
  input: string;
  photo: CalibrationPhoto | undefined;
}): CalibrationPreview | null {
  const mm = parseCalibrationMm(input);
  if (mm === null || distancePx < 5) return null;
  const pxPerMm = distancePx / mm;
  if (!(pxPerMm >= 0.1 && pxPerMm <= 1000)) return null;

  return {
    pxPerMm,
    umPerPx: 1000 / pxPerMm,
    ...(photo && { photoMm: calibrationPhotoSize(photo, pxPerMm) }),
  };
}
