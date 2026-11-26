import type { Vec2 } from '../model/primitives';
import { bodyLocalOutline } from './body-outline';
import type { BodyMarkKind, BodyMarkSpec, BodyShapeSpec, FootprintGeom } from './types';

export interface BodyMark {
  kind: BodyMarkKind;
  lines: Vec2[][];
  filled: boolean;
}

function clipToHalfPlane(
  outline: readonly Vec2[],
  signedDistance: (point: Vec2) => number,
): Vec2[] {
  const clipped: Vec2[] = [];
  let previous = outline.at(-1);
  if (!previous) return clipped;
  let previousDistance = signedDistance(previous);
  for (const point of outline) {
    const distance = signedDistance(point);
    if ((previousDistance < 0 && distance > 0) || (previousDistance > 0 && distance < 0)) {
      const ratio = previousDistance / (previousDistance - distance);
      clipped.push({
        x: previous.x + ratio * (point.x - previous.x),
        y: previous.y + ratio * (point.y - previous.y),
      });
    }
    if (distance >= 0) clipped.push({ ...point });
    previous = point;
    previousDistance = distance;
  }
  return clipped;
}

function polarityMark(
  geometry: FootprintGeom,
  shape: BodyShapeSpec,
  spec: Extract<BodyMarkSpec, { kind: 'plus' | 'band' }>,
): BodyMark | undefined {
  const pad = geometry.pads.find(({ name }) => name === spec.pin);
  if (!pad) return undefined;

  const { w, h } = geometry.body;
  const axis = Math.abs(pad.x) >= Math.abs(pad.y) ? 'x' : 'y';
  const sign = Math.sign(pad[axis]);
  if (sign === 0) return undefined;
  const length = axis === 'x' ? w : h;
  if (spec.kind === 'band') {
    const outline = bodyLocalOutline(geometry.body, shape);
    const stripe = clipToHalfPlane(outline, (point) => sign * point[axis] - 0.35 * length);
    return { kind: 'band', lines: [stripe], filled: true };
  }

  const along = (sign * length) / 4;
  const center = axis === 'x' ? { x: along, y: -h / 4 } : { x: -w / 4, y: along };
  const { x, y } = center;
  const arm = 0.1 * Math.min(w, h);
  return {
    kind: 'plus',
    filled: false,
    lines: [
      [
        { x: x - arm, y },
        { x: x + arm, y },
      ],
      [
        { x, y: y - arm },
        { x, y: y + arm },
      ],
    ],
  };
}

function notch(
  { w, h }: FootprintGeom['body'],
  at: Extract<BodyMarkSpec, { kind: 'notch' }>['at'],
): Vec2[] {
  const top = -h / 2;
  if (at === 'corner') {
    const left = -w / 2;
    const cut = 0.1 * Math.min(w, h);
    return [
      { x: left + cut, y: top },
      { x: left, y: top + cut },
    ];
  }

  const radius = Math.min(1, w / 6);
  return Array.from({ length: 13 }, (_, index) => {
    const angle = Math.PI - (index * Math.PI) / 12;
    return { x: radius * Math.cos(angle), y: top + radius * Math.sin(angle) };
  });
}

export function bodyLocalMarks(
  geometry: FootprintGeom,
  shape: BodyShapeSpec,
  specs: readonly BodyMarkSpec[],
): BodyMark[] {
  const { body } = geometry;
  if (body.w <= 0 || body.h <= 0) return [];
  const marks: BodyMark[] = [];
  for (const spec of specs) {
    switch (spec.kind) {
      case 'plus':
      case 'band': {
        const mark = polarityMark(geometry, shape, spec);
        if (mark) marks.push(mark);
        break;
      }
      case 'notch':
        marks.push({ kind: 'notch', lines: [notch(body, spec.at)], filled: false });
        break;
      case 'tab': {
        const edge = -body.h / 2 + 1.3;
        const plate = clipToHalfPlane(bodyLocalOutline(body, shape), ({ y }) => edge - y);
        marks.push({ kind: 'tab', lines: [plate], filled: true });
        break;
      }
    }
  }
  return marks;
}
