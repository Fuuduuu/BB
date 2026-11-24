import type { Snapshot } from '@pcbk/contracts';
import type { EndRef, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import type { Preview, TranslatePreviewData } from '@pcbk/ui';
import { previewBoardScale, readScaleDrag, SCALE_DRAG_OWNER } from '../../components/contract';

export const WAYPOINT_DRAG_OWNER = 'connections.waypoint';
export const JUNCTION_DRAG_OWNER = 'connections.junction';
export const CONNECTION_PREVIEW_OWNERS = [
  'select',
  WAYPOINT_DRAG_OWNER,
  JUNCTION_DRAG_OWNER,
  SCALE_DRAG_OWNER,
];

type Delta = { dx: number; dy: number };
type DragData = Delta & { id: string };
type Motion =
  | (Delta & { kind: 'components'; ids: Set<string> })
  | (DragData & { kind: 'waypoint' | 'junction' })
  | { kind: 'scale'; componentId: string; positions: Map<string, Vec2> };

export const waypointId = (id: string, index: number) => `${id}:${index}`;

export function connectionMotion(
  preview: Preview | null,
  doc?: Snapshot['doc'],
): Motion | undefined {
  if (preview?.owner === 'select') {
    const { items, dx, dy } = preview.data as TranslatePreviewData;
    const ids = new Set(items.filter(({ kind }) => kind === 'component').map(({ id }) => id));
    return { kind: 'components', ids, dx, dy };
  }
  if (preview?.owner === WAYPOINT_DRAG_OWNER || preview?.owner === JUNCTION_DRAG_OWNER) {
    return {
      ...(preview.data as DragData),
      kind: preview.owner === WAYPOINT_DRAG_OWNER ? 'waypoint' : 'junction',
    };
  }
  if (preview?.owner === SCALE_DRAG_OWNER && doc) {
    const drag = readScaleDrag(preview.data);
    const component = drag && doc.components.find(({ id }) => id === drag.componentId);
    if (!component?.board) return;
    const { pxPerMm } = doc.scale;
    const board = previewBoardScale(component.board, component.id, drag, pxPerMm);
    if (board === component.board) return;
    const pads = boardPads(
      board,
      component.pins.map(({ id }) => id),
      pxPerMm,
    );
    const positions = new Map<string, Vec2>();
    for (const { pinId, at } of pads) {
      if (!positions.has(pinId)) positions.set(pinId, at);
    }
    return { kind: 'scale', componentId: component.id, positions };
  }
}

const translated = (at: Vec2, { dx, dy }: Delta): Vec2 => ({ x: at.x + dx, y: at.y + dy });

export function previewJunction(at: Vec2, id: string, motion?: Motion): Vec2 {
  return motion?.kind === 'junction' && motion.id === id ? translated(at, motion) : at;
}

export function previewWaypoint(at: Vec2, id: string, index: number, motion?: Motion): Vec2 {
  return motion?.kind === 'waypoint' && motion.id === waypointId(id, index)
    ? translated(at, motion)
    : at;
}

export function previewEnd(at: Vec2, end: EndRef, motion?: Motion): Vec2 {
  if ('junction' in end) return previewJunction(at, end.junction, motion);
  if (motion?.kind === 'scale' && motion.componentId === end.pin.c) {
    const next = motion.positions.get(end.pin.p);
    return next && (next.x !== at.x || next.y !== at.y) ? next : at;
  }
  return motion?.kind === 'components' && motion.ids.has(end.pin.c) ? translated(at, motion) : at;
}

export function previewConnectionPoints(
  points: Vec2[],
  { id, a, b }: { id: string; a: EndRef; b: EndRef },
  motion?: Motion,
): Vec2[] {
  if (!motion) return points;
  const start = previewEnd(points[0]!, a, motion);
  const end = previewEnd(points.at(-1)!, b, motion);
  if (motion.kind !== 'waypoint' && start === points[0] && end === points.at(-1)) return points;
  if (motion.kind === 'waypoint' && !motion.id.startsWith(`${id}:`)) return points;
  const waypoints = points.slice(1, -1).map((at, index) => previewWaypoint(at, id, index, motion));
  return [start, ...waypoints, end];
}
