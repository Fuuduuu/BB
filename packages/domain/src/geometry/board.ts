import { footprintGeometry } from '../footprints';
import type { BoardPlacement } from '../model/component';
import type { Vec2 } from '../model/primitives';

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

export function boardPads(
  placement: BoardPlacement,
  pinIds: readonly string[],
  pxPerMm: number,
): { pinId: string; at: Vec2; radiusPx: number }[] {
  const pads: { pinId: string; at: Vec2; radiusPx: number }[] = [];
  const pins = new Set(pinIds);
  const geometry = footprintGeometry(placement.footprint, placement.params);

  function appendPad(pinId: string, local: Vec2, w: number, h: number) {
    pads.push({
      pinId,
      at: padToBoard(placement, local, pxPerMm),
      radiusPx: (Math.max(w * placement.scaleX, h * placement.scaleY) * pxPerMm) / 2,
    });
  }

  for (const pad of geometry?.pads ?? []) {
    const pinId = placement.padMap?.[pad.id] ?? pad.id;
    if (pins.has(pinId)) appendPad(pinId, pad, pad.w, pad.h);
  }
  for (const pinId of pins) {
    if (!Object.hasOwn(placement.customPads, pinId)) continue;
    const pad = placement.customPads[pinId];
    if (pad) appendPad(pinId, pad.local, pad.sizeMm, pad.sizeMm);
  }
  return pads;
}

export function bodyOutline(placement: BoardPlacement, pxPerMm: number): Vec2[] {
  const geometry = footprintGeometry(placement.footprint, placement.params);
  if (!geometry) return [];

  const halfW = geometry.body.w / 2;
  const halfH = geometry.body.h / 2;
  return [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ].map((corner) => padToBoard(placement, corner, pxPerMm));
}
