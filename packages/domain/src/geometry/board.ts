import { bodyLocalOutline, footprintBodyShape, footprintGeometry } from '../footprints';
import type { PadGeom } from '../footprints';
import type { BoardPlacement } from '../model/component';
import type { Vec2 } from '../model/primitives';

export { boardSurface, sceneTransformOf } from './surface';
export type { SceneSource, SurfaceSource } from './surface';
export { drawingSegmentPoints, projectDrawingSegment, wirePath } from './drawing';

export function padToBoard(
  p: Pick<BoardPlacement, 'center' | 'rotationDeg' | 'side' | 'scaleX' | 'scaleY'>,
  local: Vec2,
  pxPerMm: number,
): Vec2 {
  const x = local.x * p.scaleX * (p.side === 'bottom' ? -1 : 1);
  const y = local.y * p.scaleY;
  const angle = ((p.rotationDeg % 360) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: p.center.x + (x * cos - y * sin) * pxPerMm,
    y: p.center.y + (x * sin + y * cos) * pxPerMm,
  };
}

export function boardToPad(
  p: Pick<BoardPlacement, 'center' | 'rotationDeg' | 'side' | 'scaleX' | 'scaleY'>,
  point: Vec2,
  pxPerMm: number,
): Vec2 {
  const x = (point.x - p.center.x) / pxPerMm;
  const y = (point.y - p.center.y) / pxPerMm;
  const angle = ((p.rotationDeg % 360) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: ((x * cos + y * sin) / p.scaleX) * (p.side === 'bottom' ? -1 : 1),
    y: (-x * sin + y * cos) / p.scaleY,
  };
}

export function boardPads(
  placement: BoardPlacement,
  pinIds: readonly string[],
  pxPerMm: number,
): {
  pinId: string;
  at: Vec2;
  radiusPx: number;
  halfPx: Vec2;
  angleDeg: number;
  shape: PadGeom['shape'];
  through: boolean;
}[] {
  const pads: ReturnType<typeof boardPads> = [];
  const pins = new Set(pinIds);
  const geometry = footprintGeometry(placement.footprint, placement.params);

  function appendPad(
    pinId: string,
    local: Vec2,
    w: number,
    h: number,
    shape: PadGeom['shape'],
    through: boolean,
  ) {
    pads.push({
      pinId,
      at: padToBoard(placement, local, pxPerMm),
      radiusPx: (Math.max(w * placement.scaleX, h * placement.scaleY) * pxPerMm) / 2,
      halfPx: {
        x: (w * placement.scaleX * pxPerMm) / 2,
        y: (h * placement.scaleY * pxPerMm) / 2,
      },
      angleDeg: placement.rotationDeg,
      shape,
      through,
    });
  }

  for (const pad of geometry?.pads ?? []) {
    const pinId = placement.padMap?.[pad.id] ?? pad.id;
    if (pins.has(pinId)) appendPad(pinId, pad, pad.w, pad.h, pad.shape, pad.through);
  }
  for (const pinId of pins) {
    if (!Object.hasOwn(placement.customPads, pinId)) continue;
    const pad = placement.customPads[pinId];
    if (pad) appendPad(pinId, pad.local, pad.sizeMm, pad.sizeMm, pad.shape, pad.through);
  }
  return pads;
}

export function bodyOutline(placement: BoardPlacement, pxPerMm: number): Vec2[] {
  const geometry = footprintGeometry(placement.footprint, placement.params);
  if (!geometry) return [];
  return bodyLocalOutline(geometry.body, footprintBodyShape(placement.footprint)).map((point) =>
    padToBoard(placement, point, pxPerMm),
  );
}
