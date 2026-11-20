import type { EndRef, Vec2 } from '@pcbk/domain';
import type { Preview, TranslatePreviewData } from '@pcbk/ui';

export const WAYPOINT_DRAG_OWNER = 'connections.waypoint';
export const JUNCTION_DRAG_OWNER = 'connections.junction';
export const CONNECTION_PREVIEW_OWNERS = ['select', WAYPOINT_DRAG_OWNER, JUNCTION_DRAG_OWNER];

type Delta = { dx: number; dy: number };
type DragData = Delta & { id: string };
type Motion =
  | (Delta & { kind: 'components'; ids: Set<string> })
  | (DragData & { kind: 'waypoint' | 'junction' });

export const waypointId = (id: string, index: number) => `${id}:${index}`;

export function connectionMotion(preview: Preview | null): Motion | undefined {
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
