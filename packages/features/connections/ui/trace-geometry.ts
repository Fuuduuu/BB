import type { Snapshot } from '@pcbk/contracts';
import type { Connection, EndRef, Layer, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import type { HitItem, HitMatch } from '@pcbk/ui';
import { connectionPoints, projectDrawingSegment } from './connection-geometry';

export type Drawing = NonNullable<Connection['board']>;

export type EndpointHit = {
  end: EndRef;
  outline:
    | { type: 'junction'; at: Vec2; radius: number }
    | { type: 'pad'; pad: ReturnType<typeof boardPads>[number] };
};

export type DrawingHit = {
  id: string;
  segment: number;
  at: Vec2;
  a: Vec2;
  b: Vec2;
  kind: Drawing['kind'];
};

export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export function snappedWaypoint(from: Vec2, to: Vec2): Vec2 {
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  const length = distance(from, to);
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}

export function endpointHit(
  doc: Snapshot['doc'],
  hit: HitItem | undefined,
): EndpointHit | undefined {
  if (!hit || (hit.shape.type !== 'rect' && hit.shape.type !== 'point')) return;
  const { at } = hit.shape;
  if (hit.kind === 'pin' && hit.componentId) {
    const board = doc.components.find(({ id }) => id === hit.componentId)?.board;
    const pad =
      board &&
      boardPads(board, [hit.id], doc.scale.pxPerMm).find(
        (pad) => pad.at.x === at.x && pad.at.y === at.y,
      );
    if (pad) {
      return { end: { pin: { c: hit.componentId, p: hit.id } }, outline: { type: 'pad', pad } };
    }
  }
  if (hit.kind === 'junction' && hit.shape.type === 'point') {
    return {
      end: { junction: hit.id },
      outline: { type: 'junction', at, radius: hit.shape.r },
    };
  }
}

export function drawingHits(doc: Snapshot['doc'], matches: HitMatch[], cursor: Vec2): DrawingHit[] {
  const seen = new Set<string>();
  const hits: { hit: DrawingHit; gap: number }[] = [];
  for (const { item } of matches) {
    const { id, shape, data } = item;
    if (item.kind !== 'connection' || shape.type !== 'segment' || shape.widthUnit) continue;
    if (typeof data !== 'object' || !data || !('segment' in data)) continue;
    const { segment } = data;
    if (typeof segment !== 'number') continue;
    // Several hit shapes can represent the same curved wire segment.
    const key = `${id}:${segment}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const connection = doc.connections.find((entry) => entry.id === id);
    if (!connection?.board) continue;
    const points = connectionPoints(doc, connection);
    const a = points?.[segment];
    const b = points?.[segment + 1];
    if (!a || !b) continue;
    const { kind } = connection.board;
    const at = projectDrawingSegment(cursor, a, b, kind);
    const gap = distance(at, cursor);
    // Project onto the actual drawing so sampled wires use the rendered stroke.
    if (gap <= shape.width / 2) hits.push({ hit: { id, segment, at, a, b, kind }, gap });
  }
  return hits.sort((a, b) => a.gap - b.gap).map(({ hit }) => hit);
}

export const activeLayer = (doc: Snapshot['doc']): Layer =>
  doc.photos.find(({ id }) => id === doc.activePhotoId)?.side ?? 'top';
