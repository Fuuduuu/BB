import { boardPads } from '../geometry/board';
import type { BoardDoc } from '../model/board';
import type { BoardPlacement } from '../model/component';
import type { Vec2 } from '../model/primitives';
import { RuleRejected, RuleTargetNotFound } from './errors';

export type PhysicalPin = { id: string; padIndex: number };

function pinPairInMm(board: BoardPlacement, pinA: PhysicalPin, pinB: PhysicalPin) {
  // Measure in the part's frame to avoid rounding from the old placement.
  const unitPlacement = {
    ...board,
    center: { x: 0, y: 0 },
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
  };
  const a = boardPads(unitPlacement, [pinA.id], 1)[pinA.padIndex]?.at;
  const b = boardPads(unitPlacement, [pinB.id], 1)[pinB.padIndex]?.at;
  if (!a || !b) return undefined;
  return { a, b, mm: Math.hypot(b.x - a.x, b.y - a.y) };
}

export function pinSpacingMm(
  board: BoardPlacement,
  pinA: PhysicalPin,
  pinB: PhysicalPin,
): number | undefined {
  return pinPairInMm(board, pinA, pinB)?.mm;
}

export function scaleFromPins(
  doc: BoardDoc,
  {
    componentId,
    pinA,
    pinB,
    targetA,
    targetB,
  }: { componentId: string; pinA: PhysicalPin; pinB: PhysicalPin; targetA: Vec2; targetB: Vec2 },
): void {
  const component = doc.components.find(({ id }) => id === componentId);
  if (!component) throw new RuleTargetNotFound(componentId);
  const { board } = component;
  if (!board) throw new RuleRejected('not_placed');
  if (pinA.id === pinB.id) throw new RuleRejected('pins_coincide');
  const pair = pinPairInMm(board, pinA, pinB);
  if (!pair || pair.mm === 0) throw new RuleRejected('pins_coincide');

  const { a, b, mm } = pair;
  const targetX = targetB.x - targetA.x;
  const targetY = targetB.y - targetA.y;
  const distance = Math.hypot(targetX, targetY);
  const pxPerMm = distance / mm;
  if (distance < 5 || !(pxPerMm >= 0.1 && pxPerMm <= 1000)) {
    throw new RuleRejected('scale_from_pins_out_of_range');
  }

  const rotation = Math.atan2(targetY, targetX) - Math.atan2(b.y - a.y, b.x - a.x);
  const rotationDeg = ((rotation * 180) / Math.PI) % 360;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const offsetX = -a.x * pxPerMm;
  const offsetY = -a.y * pxPerMm;
  const center = {
    x: targetA.x + (offsetX * cos - offsetY * sin),
    y: targetA.y + (offsetX * sin + offsetY * cos),
  };

  doc.scale = { pxPerMm, calibrated: true, calib: { a: targetA, b: targetB, mm } };
  board.scaleX = 1;
  board.scaleY = 1;
  board.rotationDeg = (rotationDeg < 0 ? rotationDeg + 360 : rotationDeg) % 360 || 0;
  board.center = center;
}
