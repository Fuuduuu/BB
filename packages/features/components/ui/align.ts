import type { BoardPlacement, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { COMPONENT_SCALE_MAX, COMPONENT_SCALE_MIN } from '../contract';

export type SelectedAlignPin = { id: string; padIndex: number };
type AlignPin = string | SelectedAlignPin;

interface AlignInput {
  board: BoardPlacement;
  pxPerMm: number;
  pinA: AlignPin;
  pinB: AlignPin;
  targetA: Vec2;
  targetB: Vec2;
  minTargetDistance: number;
}

type AlignResult =
  | ({ ok: true } & Pick<BoardPlacement, 'center' | 'rotationDeg' | 'scaleX' | 'scaleY'>)
  | {
      ok: false;
      reason: 'same_pin' | 'pins_coincide' | 'targets_coincide' | 'scale_out_of_range';
    };

export function scaleBasisKey(board: BoardPlacement): string {
  return JSON.stringify([board.footprint, board.params, board.padMap ?? null]);
}

function pinId(pin: AlignPin): string {
  return typeof pin === 'string' ? pin : pin.id;
}

export function hitAlignPin(
  board: BoardPlacement,
  id: string,
  pxPerMm: number,
  center: Vec2,
): SelectedAlignPin | undefined {
  const padIndex = boardPads(board, [id], pxPerMm).findIndex(
    ({ at }) => at.x === center.x && at.y === center.y,
  );
  return padIndex >= 0 ? { id, padIndex } : undefined;
}

export function alignPinPosition(
  board: BoardPlacement,
  pin: AlignPin,
  pxPerMm: number,
): Vec2 | undefined {
  const pads = boardPads(board, [pinId(pin)], pxPerMm);
  // An ID alone may refer to multiple physical pads. A canvas hit identifies one of them.
  if (typeof pin !== 'string') return pads[pin.padIndex]?.at;
  return pads.length === 1 ? pads[0]?.at : undefined;
}

function maxCoordinate(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y));
}

function scaleAtBoundary(value: number, roundoff: number): number {
  if (value < COMPONENT_SCALE_MIN && COMPONENT_SCALE_MIN - value <= roundoff)
    return COMPONENT_SCALE_MIN;
  if (value > COMPONENT_SCALE_MAX && value - COMPONENT_SCALE_MAX <= roundoff)
    return COMPONENT_SCALE_MAX;
  return value;
}

export function alignByTwoPins({
  board,
  pxPerMm,
  pinA,
  pinB,
  targetA,
  targetB,
  minTargetDistance,
}: AlignInput): AlignResult {
  if (pinId(pinA) === pinId(pinB)) return { ok: false, reason: 'same_pin' };
  const currentA = alignPinPosition(board, pinA, pxPerMm);
  const currentB = alignPinPosition(board, pinB, pxPerMm);
  if (!currentA || !currentB) return { ok: false, reason: 'pins_coincide' };

  const sourceX = currentB.x - currentA.x;
  const sourceY = currentB.y - currentA.y;
  const sourceDistance = Math.hypot(sourceX, sourceY);
  if (sourceDistance === 0) return { ok: false, reason: 'pins_coincide' };

  const targetX = targetB.x - targetA.x;
  const targetY = targetB.y - targetA.y;
  const targetDistance = Math.hypot(targetX, targetY);
  if (targetDistance === 0 || targetDistance < minTargetDistance)
    return { ok: false, reason: 'targets_coincide' };

  const factor = targetDistance / sourceDistance;
  // Subtracting nearby coordinates can round a legal boundary just outside the schema.
  // Only absorb numerical noise, keeping genuinely out-of-range alignments invalid.
  const factorRoundoff =
    (2 *
      Number.EPSILON *
      (maxCoordinate(currentA, currentB) * factor + maxCoordinate(targetA, targetB))) /
    sourceDistance;
  const scaleX = scaleAtBoundary(
    board.scaleX * factor,
    Math.min(1e-12, board.scaleX * factorRoundoff),
  );
  const scaleY = scaleAtBoundary(
    board.scaleY * factor,
    Math.min(1e-12, board.scaleY * factorRoundoff),
  );
  const scalesInRange =
    Math.min(scaleX, scaleY) >= COMPONENT_SCALE_MIN &&
    Math.max(scaleX, scaleY) <= COMPONENT_SCALE_MAX;
  if (!scalesInRange) return { ok: false, reason: 'scale_out_of_range' };

  const rotation = Math.atan2(targetY, targetX) - Math.atan2(sourceY, sourceX);
  const rotationDeg = ((board.rotationDeg % 360) + (rotation * 180) / Math.PI) % 360;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const offsetX = (board.center.x - currentA.x) * factor;
  const offsetY = (board.center.y - currentA.y) * factor;
  return {
    ok: true,
    center: {
      x: targetA.x + (offsetX * cos - offsetY * sin),
      y: targetA.y + (offsetX * sin + offsetY * cos),
    },
    rotationDeg: (rotationDeg < 0 ? rotationDeg + 360 : rotationDeg) % 360 || 0,
    scaleX,
    scaleY,
  };
}
