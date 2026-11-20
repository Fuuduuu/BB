import type { Snapshot } from '@pcbk/contracts';
import type { Connection, EndRef, Layer, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import type { HitItem } from '@pcbk/ui';
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

export function drawingHit(
  doc: Snapshot['doc'],
  hit: HitItem | undefined,
  cursor: Vec2,
): DrawingHit | undefined {
  if (hit?.kind !== 'connection' || hit.shape.type !== 'segment' || hit.shape.widthUnit) return;
  const { data } = hit;
  if (typeof data !== 'object' || !data || !('segment' in data)) return;
  const { segment } = data;
  if (typeof segment !== 'number') return;
  const connection = doc.connections.find(({ id }) => id === hit.id);
  if (!connection?.board) return;
  const points = connectionPoints(doc, connection);
  const a = points?.[segment];
  const b = points?.[segment + 1];
  if (!a || !b) return;
  const at = projectDrawingSegment(cursor, a, b, connection.board.kind);
  // The hit width is built from the same zoom as the rendered stroke.
  if (distance(at, cursor) > hit.shape.width / 2) return;
  return { id: hit.id, segment, at, a, b, kind: connection.board.kind };
}

export const activeLayer = (doc: Snapshot['doc']): Layer =>
  doc.photos.find(({ id }) => id === doc.activePhotoId)?.side ?? 'top';
