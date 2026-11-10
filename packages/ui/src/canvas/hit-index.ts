import type { Vec2 } from '@pcbk/domain';
import type { SelectionItem } from '../shell/session-store';
import type { ToolApi } from './tools';

export type HitShape =
  | { type: 'point'; at: Vec2; r: number }
  | { type: 'segment'; a: Vec2; b: Vec2; width: number }
  | { type: 'area'; polygon: Vec2[] };

export type HitDrag = { owner: string; commit(delta: Vec2, api: ToolApi): void };

export interface HitItem {
  kind: string;
  id: string;
  componentId?: string;
  shape: HitShape;
  priority?: number;
  data?: unknown;
  target?: SelectionItem;
  drag?: HitDrag;
}

export interface HitIndex {
  query(world: Vec2, zoom: number): HitItem | undefined;
}

type CellRange = { left: number; top: number; right: number; bottom: number };

const minScreenRadius = 6;
const maxCellsPerItem = 4096;

function nativeRadius(shape: HitShape): number {
  switch (shape.type) {
    case 'point':
      return shape.r;
    case 'segment':
      return shape.width / 2;
    case 'area':
      return 0;
  }
}

function shapePoints(shape: HitShape): Vec2[] {
  switch (shape.type) {
    case 'point':
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

function shapeDistance(world: Vec2, shape: HitShape): number {
  switch (shape.type) {
    case 'point':
      return Math.hypot(world.x - shape.at.x, world.y - shape.at.y);
    case 'segment':
      return segmentDistance(world, shape.a, shape.b);
    case 'area':
      return polygonDistance(world, shape.polygon);
  }
}

export function createHitIndex(items: HitItem[], cellPx = 32): HitIndex {
  const cells = new Map<string, HitItem[]>();
  const oversized: HitItem[] = [];
  for (const item of items) {
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

  return {
    query(world, zoom) {
      const minRadius = minScreenRadius / zoom;
      const range = cellRange([world], minRadius, cellPx);
      let candidates: Iterable<HitItem> = items;
      // For a broad query, scanning the items is cheaper than visiting empty cells.
      if (cellCount(range) <= cells.size) {
        const nearby = new Set(oversized);
        for (const key of cellKeys(range)) {
          for (const item of cells.get(key) ?? []) nearby.add(item);
        }
        candidates = nearby;
      }

      let best: HitItem | undefined;
      let bestPriority = -Infinity;
      let bestDistance = Infinity;
      for (const item of candidates) {
        const priority = item.priority ?? 0;
        if (priority < bestPriority) continue;
        const distance = shapeDistance(world, item.shape);
        if (
          !Number.isFinite(distance) ||
          distance > Math.max(minRadius, nativeRadius(item.shape))
        ) {
          continue;
        }
        if (priority > bestPriority || distance < bestDistance) {
          best = item;
          bestPriority = priority;
          bestDistance = distance;
        }
      }
      return best;
    },
  };
}
