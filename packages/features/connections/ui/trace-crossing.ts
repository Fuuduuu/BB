import type { Snapshot } from '@pcbk/contracts';
import type { Layer, Vec2 } from '@pcbk/domain';
import { connectionPoints } from './connection-geometry';
import type { TraceDraft, TraceMode } from './trace-store';

type Doc = Snapshot['doc'];
type Segment = { id: string; a: Vec2; b: Vec2; halfWidth: number };
type ConfirmedPath = { doc: Doc; mode: TraceMode; crossing?: Vec2 };

const segmentsByDoc = new WeakMap<Doc, Record<Layer, Segment[]>>();
const confirmedPaths = new WeakMap<TraceDraft, ConfirmedPath>();
const collinearEpsilon = 1e-7;

function layerSegments(doc: Doc, layer: Layer): readonly Segment[] {
  let layers = segmentsByDoc.get(doc);
  if (!layers) {
    layers = { top: [], bottom: [] };
    for (const connection of doc.connections) {
      const { board, id } = connection;
      if (board?.kind !== 'trace') continue;
      const points = connectionPoints(doc, connection);
      if (!points) continue;
      const halfWidth = (board.widthMm * doc.scale.pxPerMm) / 2;
      for (let index = 1; index < points.length; index++) {
        layers[board.layer].push({ id, a: points[index - 1]!, b: points[index]!, halfWidth });
      }
    }
    segmentsByDoc.set(doc, layers);
  }
  return layers[layer];
}

function intersectionDistance(
  from: Vec2,
  direction: Vec2,
  length: number,
  { a, b, halfWidth }: Segment,
): number | undefined {
  const ax = a.x - from.x;
  const ay = a.y - from.y;
  const bx = b.x - from.x;
  const by = b.y - from.y;
  const alongA = ax * direction.x + ay * direction.y;
  const alongB = bx * direction.x + by * direction.y;
  const crossA = direction.x * ay - direction.y * ax;
  const crossB = direction.x * by - direction.y * bx;
  const acrossA = Math.abs(crossA) < collinearEpsilon ? 0 : crossA;
  const acrossB = Math.abs(crossB) < collinearEpsilon ? 0 : crossB;
  const interiorEnd = length - halfWidth;

  if (acrossA === 0 && acrossB === 0) {
    const overlapStart = Math.max(Math.min(alongA, alongB), halfWidth);
    const overlapEnd = Math.min(Math.max(alongA, alongB), interiorEnd);
    return overlapStart < overlapEnd ? overlapStart : undefined;
  }
  const position = acrossA / (acrossA - acrossB);
  if (!(position >= 0 && position <= 1)) return;
  const distance = alongA + (alongB - alongA) * position;
  if (distance > halfWidth && distance < interiorEnd) return distance;
}

export function sameLayerCrossing(
  doc: Doc,
  draft: TraceDraft,
  from: Vec2,
  to: Vec2,
  mode: TraceMode,
): Vec2 | undefined {
  if (mode.kind === 'wire') return;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0 || !Number.isFinite(length)) return;
  const direction = { x: dx / length, y: dy / length };
  let nearest = Infinity;
  for (const segment of layerSegments(doc, mode.layer)) {
    if (segment.id === draft.existingId) continue;
    const distance = intersectionDistance(from, direction, length, segment);
    if (distance !== undefined && distance < nearest) nearest = distance;
  }
  if (nearest < Infinity) {
    return { x: from.x + direction.x * nearest, y: from.y + direction.y * nearest };
  }
}

export function tracePathCrossing(
  doc: Doc,
  draft: TraceDraft,
  start: Vec2,
  to: Vec2 | undefined,
  mode: TraceMode,
): Vec2 | undefined {
  if (mode.kind === 'wire') return;
  let confirmed = confirmedPaths.get(draft);
  if (confirmed?.doc !== doc || confirmed.mode !== mode) {
    // Changing layers changes the whole draft, including the accepted waypoints.
    let from = start;
    let crossing: Vec2 | undefined;
    for (const waypoint of draft.waypoints) {
      crossing = sameLayerCrossing(doc, draft, from, waypoint, mode);
      if (crossing) break;
      from = waypoint;
    }
    confirmed = { doc, mode, crossing };
    confirmedPaths.set(draft, confirmed);
  }
  return (
    confirmed.crossing ??
    (to && sameLayerCrossing(doc, draft, draft.waypoints.at(-1) ?? start, to, mode))
  );
}
