import type { BoardPlacement, Vec2 } from '@pcbk/domain';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { padToBoard } from '@pcbk/domain/geometry';
import { COMPONENT_SCALE_MAX, COMPONENT_SCALE_MIN } from '../../contract';

export const SCALE_DRAG_OWNER = 'components.scale';
const handles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
type ScaleHandle = (typeof handles)[number];

export function readScaleDrag(data: unknown) {
  const preview = data as { id: string; dx: number; dy: number };
  const separator = preview.id.lastIndexOf(':');
  const handle = handles.find((candidate) => candidate === preview.id.slice(separator + 1));
  return separator > 0 && handle
    ? { componentId: preview.id.slice(0, separator), handle, dx: preview.dx, dy: preview.dy }
    : null;
}

const directions: Record<ScaleHandle, Vec2> = {
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
  nw: { x: -1, y: -1 },
};

function footprintHalfSize(board: BoardPlacement): Vec2 {
  const geometry = footprintGeometry(board.footprint, board.params);
  const half = { x: (geometry?.body.w ?? 0) / 2, y: (geometry?.body.h ?? 0) / 2 };
  for (const pad of geometry?.pads ?? []) {
    half.x = Math.max(half.x, Math.abs(pad.x) + pad.w / 2);
    half.y = Math.max(half.y, Math.abs(pad.y) + pad.h / 2);
  }
  for (const { local, sizeMm } of Object.values(board.customPads)) {
    half.x = Math.max(half.x, Math.abs(local.x) + sizeMm / 2);
    half.y = Math.max(half.y, Math.abs(local.y) + sizeMm / 2);
  }
  // A legacy placement may have no drawable footprint or pad on an axis.
  return { x: half.x || 0.5, y: half.y || 0.5 };
}

function clampScale(value: number): number {
  return Math.max(COMPONENT_SCALE_MIN, Math.min(COMPONENT_SCALE_MAX, value));
}

export function scaleFromHandle(
  board: BoardPlacement,
  handle: ScaleHandle,
  delta: Vec2,
  pxPerMm: number,
): Pick<BoardPlacement, 'scaleX' | 'scaleY'> {
  const { x, y } = directions[handle];
  const half = footprintHalfSize(board);
  const angle = ((board.rotationDeg % 360) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = (delta.x * cos + delta.y * sin) * (board.side === 'bottom' ? -1 : 1);
  const dy = -delta.x * sin + delta.y * cos;
  const baseX = half.x * pxPerMm;
  const baseY = half.y * pxPerMm;
  if (x === 0) return { scaleX: board.scaleX, scaleY: clampScale(board.scaleY + (y * dy) / baseY) };
  if (y === 0) return { scaleX: clampScale(board.scaleX + (x * dx) / baseX), scaleY: board.scaleY };

  // Project along this corner's diagonal and limit the shared factor to keep its proportions.
  const vx = x * baseX * board.scaleX;
  const vy = y * baseY * board.scaleY;
  const factor = 1 + (dx * vx + dy * vy) / (vx * vx + vy * vy);
  const low = COMPONENT_SCALE_MIN / Math.min(board.scaleX, board.scaleY);
  const high = COMPONENT_SCALE_MAX / Math.max(board.scaleX, board.scaleY);
  const bounded = Math.max(low, Math.min(high, factor));
  return { scaleX: clampScale(board.scaleX * bounded), scaleY: clampScale(board.scaleY * bounded) };
}

export function previewBoardScale(
  board: BoardPlacement,
  id: string,
  drag: ReturnType<typeof readScaleDrag>,
  pxPerMm: number,
): BoardPlacement {
  if (drag?.componentId !== id) return board;
  const scale = scaleFromHandle(board, drag.handle, { x: drag.dx, y: drag.dy }, pxPerMm);
  return scale.scaleX === board.scaleX && scale.scaleY === board.scaleY
    ? board
    : { ...board, ...scale };
}

export const SCALE_HANDLE_SIZE = 8;

export function scaleHandlePositions(board: BoardPlacement, pxPerMm: number, zoom: number) {
  const half = footprintHalfSize(board);
  // Leave a screen-space gap so the squares stay outside the footprint even when rotated.
  const inset = (SCALE_HANDLE_SIZE / 2 + 2) / (pxPerMm * zoom);
  return handles.map((handle) => {
    const { x, y } = directions[handle];
    const local = {
      x: x * (half.x + inset / board.scaleX),
      y: y * (half.y + inset / board.scaleY),
    };
    return { handle, at: padToBoard(board, local, pxPerMm) };
  });
}
