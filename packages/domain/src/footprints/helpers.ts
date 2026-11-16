import { readNumber, roundMm, type FootprintGeom, type PadGeom } from './types';

export function pad(
  id: string | number,
  x: number,
  y: number,
  w: number,
  h = w,
  shape: PadGeom['shape'] = 'rect',
  drill = 0,
  name?: string,
): PadGeom {
  return {
    id: String(id),
    x: roundMm(x),
    y: roundMm(y),
    w: roundMm(w),
    h: roundMm(h),
    shape,
    through: drill > 0,
    ...(name ? { name } : {}),
  };
}

export function body(w: number, h: number, pin1?: { x: number; y: number }): FootprintGeom['body'] {
  return {
    w: roundMm(w),
    h: roundMm(h),
    ...(pin1 ? { pin1: { x: roundMm(pin1.x), y: roundMm(pin1.y) } } : {}),
  };
}

export function numberChoice(
  value: string | number | undefined,
  choices: readonly number[],
): number | undefined {
  const number = readNumber(value);
  return number !== undefined && choices.includes(number) ? number : undefined;
}

export function numberRange(
  value: string | number | undefined,
  min: number,
  max: number,
  integer = false,
): number | undefined {
  const number = readNumber(value);
  return number !== undefined &&
    number >= min &&
    number <= max &&
    (!integer || Number.isInteger(number))
    ? number
    : undefined;
}
