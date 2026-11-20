import type { Vec2 } from '@pcbk/domain';
import type { SelectionItem } from '../shell/session-store';
import type { ToolApi } from './tools';

export type HitShape =
  | { type: 'point'; at: Vec2; r: number }
  | { type: 'rect'; at: Vec2; half: Vec2; angleDeg: number }
  | { type: 'segment'; a: Vec2; b: Vec2; width: number; widthUnit?: 'screen' }
  | { type: 'area'; polygon: Vec2[] };

export type HitDrag = { owner: string; commit(delta: Vec2, api: ToolApi): void };

export interface HitItem {
  kind: string;
  id: string;
  componentId?: string;
  shape: HitShape;
  priority?: number;
  // Visibility can change without rebuilding the geometry index.
  enabled?(): boolean;
  data?: unknown;
  target?: SelectionItem;
  moves?: SelectionItem;
  drag?: HitDrag;
}

export type HitMatch = { item: HitItem; distance: number; exact: boolean };

export interface HitIndex {
  query(world: Vec2, zoom: number): HitItem | undefined;
  queryAll(world: Vec2, zoom: number): HitMatch[];
}

type CellRange = { left: number; top: number; right: number; bottom: number };

const minScreenRadius = 6;
const maxCellsPerItem = 4096;

function nativeRadius(shape: HitShape): number {
  switch (shape.type) {
    case 'point':
      return shape.r;
    case 'rect':
      return Math.hypot(shape.half.x, shape.half.y);
    case 'segment':
      return shape.widthUnit === 'screen' ? 0 : shape.width / 2;
    case 'area':
      return 0;
  }
}

function shapePoints(shape: HitShape): Vec2[] {
  switch (shape.type) {
    case 'point':
    case 'rect':
      return [shape.at];
    case 'segment':
      return [shape.a, shape.b];
    case 'area':
      return shape.polygon;
  }
}

function cellRange(points: Vec2[], radius: number, cellPx: number): CellRange {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    left: Math.floor((minX - radius) / cellPx),
    top: Math.floor((minY - radius) / cellPx),
    right: Math.floor((maxX + radius) / cellPx),
    bottom: Math.floor((maxY + radius) / cellPx),
  };
}

function cellCount({ left, top, right, bottom }: CellRange): number {
  if (![left, top, right, bottom].every(Number.isSafeInteger)) return Infinity;
  return (right - left + 1) * (bottom - top + 1);
}

function* cellKeys({ left, top, right, bottom }: CellRange): Iterable<string> {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) yield `${x},${y}`;
  }
}

function segmentDistance(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const along = (point.x - a.x) * (dx / length) + (point.y - a.y) * (dy / length);
  const t = Math.max(0, Math.min(1, along / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function polygonDistance(point: Vec2, polygon: Vec2[]): number {
  let previous = polygon.at(-1);
  if (!previous) return Infinity;
  let inside = false;
  let nearest = Infinity;
  for (const next of polygon) {
    if (next.y > point.y !== previous.y > point.y) {
      const fraction = (point.y - next.y) / (previous.y - next.y);
      if (point.x < next.x + fraction * (previous.x - next.x)) inside = !inside;
    }
    nearest = Math.min(nearest, segmentDistance(point, previous, next));
    previous = next;
  }
  return inside ? 0 : nearest;
}

function shapeDistance(world: Vec2, shape: HitShape, rectMinHalf: number): number {
  switch (shape.type) {
    case 'point':
      return Math.hypot(world.x - shape.at.x, world.y - shape.at.y);
    case 'rect': {
      const dx = world.x - shape.at.x;
      const dy = world.y - shape.at.y;
      const angle = (shape.angleDeg * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = dx * cos + dy * sin;
      const y = -dx * sin + dy * cos;
      const hx = Math.max(shape.half.x, rectMinHalf);
      const hy = Math.max(shape.half.y, rectMinHalf);
      // Keep boundary points eligible despite floating-point rotation error.
      const epsilon =
        4 *
        Number.EPSILON *
        Math.max(
          1,
          Math.abs(world.x),
          Math.abs(world.y),
          Math.abs(shape.at.x),
          Math.abs(shape.at.y),
          hx,
          hy,
        );
      return Math.abs(x) <= hx + epsilon && Math.abs(y) <= hy + epsilon
        ? Math.hypot(dx, dy)
        : Infinity;
    }
    case 'segment':
      return segmentDistance(world, shape.a, shape.b);
    case 'area':
      return polygonDistance(world, shape.polygon);
  }
}

function hitRadius(shape: HitShape, zoom: number, minRadius: number): number {
  return shape.type === 'segment' && shape.widthUnit === 'screen'
    ? shape.width / (2 * zoom)
    : Math.max(minRadius, nativeRadius(shape));
}

export function createHitIndex(items: HitItem[], cellPx = 32): HitIndex {
  const cells = new Map<string, HitItem[]>();
  const oversized: HitItem[] = [];
  let maxScreenRadius = minScreenRadius;
  for (const item of items) {
    if (item.shape.type === 'segment' && item.shape.widthUnit === 'screen') {
      maxScreenRadius = Math.max(maxScreenRadius, item.shape.width / 2);
    }
    const points = shapePoints(item.shape);
    if (points.length === 0) continue;
    const range = cellRange(points, Math.max(0, nativeRadius(item.shape)), cellPx);
    if (cellCount(range) > maxCellsPerItem) {
      oversized.push(item);
      continue;
    }
    for (const key of cellKeys(range)) {
      const bucket = cells.get(key);
      if (bucket) bucket.push(item);
      else cells.set(key, [item]);
    }
  }

  function candidatesAt(world: Vec2, zoom: number): Iterable<HitItem> {
    const range = cellRange([world], maxScreenRadius / zoom, cellPx);
    // For a broad query, scanning the items is cheaper than visiting empty cells.
    if (cellCount(range) > cells.size) return items;
    const nearby = new Set(oversized);
    for (const key of cellKeys(range)) {
      for (const item of cells.get(key) ?? []) nearby.add(item);
    }
    return nearby;
  }

  return {
    query(world, zoom) {
      const minRadius = minScreenRadius / zoom;
      const rectMinHalf = 2.5 / zoom;
      let best: HitItem | undefined;
      let bestPriority = -Infinity;
      let bestDistance = Infinity;
      for (const item of candidatesAt(world, zoom)) {
        const priority = item.priority ?? 0;
        if (priority < bestPriority || item.enabled?.() === false) continue;
        const { shape } = item;
        const distance = shapeDistance(world, shape, rectMinHalf);
        if (!Number.isFinite(distance)) continue;
        if (shape.type !== 'rect' && distance > hitRadius(shape, zoom, minRadius)) continue;
        if (priority > bestPriority || distance < bestDistance) {
          best = item;
          bestPriority = priority;
          bestDistance = distance;
        }
      }
      return best;
    },
    queryAll(world, zoom) {
      const minRadius = minScreenRadius / zoom;
      const rectMinHalf = 2.5 / zoom;
      const matches: HitMatch[] = [];
      for (const item of candidatesAt(world, zoom)) {
        if (item.enabled?.() === false) continue;
        const { shape } = item;
        const distance = shapeDistance(world, shape, rectMinHalf);
        if (!Number.isFinite(distance)) continue;
        if (shape.type !== 'rect' && distance > hitRadius(shape, zoom, minRadius)) continue;
        const exact =
          shape.type === 'rect'
            ? Number.isFinite(shapeDistance(world, shape, 0))
            : distance <= hitRadius(shape, zoom, 0);
        matches.push({ item, distance, exact });
      }
      return matches.sort(
        (a, b) => (b.item.priority ?? 0) - (a.item.priority ?? 0) || a.distance - b.distance,
      );
    },
  };
}
