import type { Vec2 } from '../model/primitives';
import type { BodyFlat, BodyShapeSpec, FootprintGeom } from './types';

const arcSegments = 48;
const fullTurn = 2 * Math.PI;
const emptyOutline: readonly Readonly<Vec2>[] = Object.freeze([]);
const outlines = new Map<string, readonly Readonly<Vec2>[]>();

function ellipse(halfW: number, halfH: number): Vec2[] {
  return Array.from({ length: arcSegments }, (_, index) => {
    const angle = (index * fullTurn) / arcSegments;
    return { x: halfW * Math.cos(angle), y: halfH * Math.sin(angle) };
  });
}

function oval(halfW: number, halfH: number): Vec2[] {
  const horizontal = halfW >= halfH;
  const radius = Math.min(halfW, halfH);
  const offset = Math.max(halfW, halfH) - radius;
  const semicircle = arcSegments / 2;
  return [1, -1].flatMap((side) =>
    Array.from({ length: semicircle + 1 }, (_, index) => {
      const angle = (index * Math.PI) / semicircle - Math.PI / 2;
      const along = side * (offset + radius * Math.cos(angle));
      const across = side * radius * Math.sin(angle);
      return horizontal ? { x: along, y: across } : { x: across, y: along };
    }),
  );
}

function flatCircle(halfW: number, halfH: number, flat: BodyFlat): Vec2[] {
  const horizontal = flat.endsWith('x');
  const halfLength = horizontal ? halfW : halfH;
  const radius = horizontal ? halfH : halfW;
  if (halfLength >= radius) return ellipse(halfW, halfH);

  const sign = flat.startsWith('+') ? 1 : -1;
  const center = radius - halfLength;
  const cutAngle = Math.acos((halfLength - center) / radius);
  const arc = fullTurn - 2 * cutAngle;
  return Array.from({ length: arcSegments + 1 }, (_, index) => {
    const angle = cutAngle + (index * arc) / arcSegments;
    const atCut = index === 0 || index === arcSegments;
    const along = sign * (atCut ? halfLength : center + radius * Math.cos(angle));
    const across = radius * Math.sin(angle);
    return horizontal ? { x: along, y: across } : { x: across, y: along };
  });
}

function outline(halfW: number, halfH: number, { shape, flat }: BodyShapeSpec): Vec2[] {
  switch (shape) {
    case 'rect':
      return [
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH },
      ];
    case 'circle':
      return ellipse(halfW, halfH);
    case 'oval':
      return oval(halfW, halfH);
    case 'd':
      return flat ? flatCircle(halfW, halfH, flat) : ellipse(halfW, halfH);
  }
}

/** Jagatud kirjutuskaitstud kontuur millimeetrites. */
export function bodyLocalOutline(
  { w, h }: FootprintGeom['body'],
  spec: BodyShapeSpec,
): readonly Readonly<Vec2>[] {
  if (w <= 0 || h <= 0) return emptyOutline;
  const key = `${spec.shape}|${spec.flat ?? ''}|${w}|${h}`;
  const cached = outlines.get(key);
  if (cached) return cached;
  const points = Object.freeze(outline(w / 2, h / 2, spec).map((point) => Object.freeze(point)));
  outlines.set(key, points);
  return points;
}
