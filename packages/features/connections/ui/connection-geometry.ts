import type { Snapshot } from '@pcbk/contracts';
import type { EndRef, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import type { DrawingKind } from '@pcbk/domain/rules';

type Doc = Snapshot['doc'];
type Connection = Doc['connections'][number];
const endpointCache = new WeakMap<Doc, (end: EndRef) => Vec2 | undefined>();
// A quadratic reaches half its control point's offset at the midpoint.
const wireControlOffset = 2 * 0.15;

function endpointLookup(doc: Doc) {
  const components = new Map(doc.components.map((component) => [component.id, component]));
  const junctions = new Map(doc.junctions.map((junction) => [junction.id, junction.board?.at]));
  const pads = new Map<string, Map<string, Vec2>>();
  return (end: EndRef): Vec2 | undefined => {
    if ('junction' in end) return junctions.get(end.junction);
    const { c, p } = end.pin;
    let positions = pads.get(c);
    if (!positions) {
      positions = new Map();
      const component = components.get(c);
      if (component?.board) {
        for (const { pinId, at } of boardPads(
          component.board,
          component.pins.map(({ id }) => id),
          doc.scale.pxPerMm,
        )) {
          if (!positions.has(pinId)) positions.set(pinId, at);
        }
      }
      pads.set(c, positions);
    }
    return positions.get(p);
  };
}

export function connectionEndpoint(doc: Doc, end: EndRef): Vec2 | undefined {
  let lookup = endpointCache.get(doc);
  if (!lookup) {
    lookup = endpointLookup(doc);
    endpointCache.set(doc, lookup);
  }
  return lookup(end);
}

export function connectionPoints(
  doc: Doc,
  { a, b, board }: Pick<Connection, 'a' | 'b' | 'board'>,
): Vec2[] | undefined {
  const start = connectionEndpoint(doc, a);
  const end = connectionEndpoint(doc, b);
  return start && end ? [start, ...(board?.waypoints ?? []), end] : undefined;
}

export function drawingWidth(widthMm: number, pxPerMm: number, zoom: number): number {
  return Math.max(widthMm * pxPerMm, 1.4 / zoom);
}

function wireDirection(a: Vec2, b: Vec2): number {
  return a.x < b.x || (a.x === b.x && a.y <= b.y) ? 1 : -1;
}

function wireControl(a: Vec2, b: Vec2): Vec2 {
  const bend = wireDirection(a, b) * wireControlOffset;
  return {
    x: (a.x + b.x) / 2 - (b.y - a.y) * bend,
    y: (a.y + b.y) / 2 + (b.x - a.x) * bend,
  };
}

export function wirePath(points: readonly Vec2[]): string {
  const start = points[0];
  if (!start) return '';
  let path = `M ${start.x} ${start.y}`;
  for (let i = 1; i < points.length; i++) {
    const end = points[i]!;
    const control = wireControl(points[i - 1]!, end);
    path += ` Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  return path;
}

function wirePoint(a: Vec2, b: Vec2, t: number): Vec2 {
  const bend = wireDirection(a, b) * 2 * wireControlOffset * t * (1 - t);
  return {
    x: a.x + (b.x - a.x) * t - (b.y - a.y) * bend,
    y: a.y + (b.y - a.y) * t + (b.x - a.x) * bend,
  };
}

export function drawingSegmentPoints(a: Vec2, b: Vec2, kind: DrawingKind, zoom: number): Vec2[] {
  if (kind === 'trace') return [a, b];
  const bendPx = wireControlOffset * Math.hypot(b.x - a.x, b.y - a.y) * zoom;
  // Sample to a quarter screen pixel without allocating unbounded hit slices.
  const slices = Math.max(1, Math.min(256, Math.ceil(Math.sqrt(2 * bendPx))));
  return Array.from({ length: slices + 1 }, (_, index) => wirePoint(a, b, index / slices));
}

function wireProjection(along: number, across: number): number {
  // In the wire's local frame the centerline is (t, bend * t * (1 - t)).
  // Solve the derivative of its squared distance on each monotone interval.
  const bend = 2 * wireControlOffset;
  const slopeAtCenter = 1 - bend ** 2 / 2 + 2 * bend * across;
  const turn = Math.sqrt(-slopeAtCenter / (6 * bend ** 2));
  const bounds = turn > 0 && turn < 0.5 ? [0, 0.5 - turn, 0.5 + turn, 1] : [0, 1];
  const heightGap = (t: number) => bend * t * (1 - t) - across;
  const slope = (t: number) => t - along + heightGap(t) * bend * (1 - 2 * t);
  let closest = 0;
  let minDistance = Infinity;
  function compare(t: number) {
    const distance = Math.hypot(t - along, heightGap(t));
    if (distance < minDistance) {
      closest = t;
      minDistance = distance;
    }
  }
  compare(0);
  for (let i = 1; i < bounds.length; i++) {
    let low = bounds[i - 1]!;
    let high = bounds[i]!;
    compare(high);
    if (slope(low) >= 0 || slope(high) <= 0) continue;
    for (let iteration = 0; iteration < 40; iteration++) {
      const mid = (low + high) / 2;
      if (slope(mid) > 0) high = mid;
      else low = mid;
    }
    compare((low + high) / 2);
  }
  return closest;
}

export function projectDrawingSegment(at: Vec2, a: Vec2, b: Vec2, kind: DrawingKind): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const squaredLength = dx * dx + dy * dy;
  if (squaredLength === 0) return a;
  const x = at.x - a.x;
  const y = at.y - a.y;
  const along = (x * dx + y * dy) / squaredLength;
  if (kind === 'wire') {
    const across = (wireDirection(a, b) * (y * dx - x * dy)) / squaredLength;
    return wirePoint(a, b, wireProjection(along, across));
  }
  const t = Math.min(1, Math.max(0, along));
  return { x: a.x + dx * t, y: a.y + dy * t };
}
