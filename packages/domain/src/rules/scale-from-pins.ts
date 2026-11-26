import { footprintGeometry } from '../footprints';
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
  const pads = boardPads(unitPlacement, [pinA.id, pinB.id], 1);
  const pinPosition = ({ id, padIndex }: PhysicalPin) =>
    pads.filter(({ pinId }) => pinId === id)[padIndex]?.at;
  const a = pinPosition(pinA);
  const b = pinPosition(pinB);
  if (!a || !b) return undefined;

  const libraryPads = footprintGeometry(board.footprint, board.params)?.pads ?? [];
  const isLibraryPad = ({ id, padIndex }: PhysicalPin) =>
    padIndex < libraryPads.filter((pad) => (board.padMap?.[pad.id] ?? pad.id) === id).length;
  return {
    a,
    b,
    mm: Math.hypot(b.x - a.x, b.y - a.y),
    hasLibraryPads: isLibraryPad(pinA) && isLibraryPad(pinB),
  };
}

export function pinSpacingMm(
  board: BoardPlacement,
  pinA: PhysicalPin,
  pinB: PhysicalPin,
): number | undefined {
  const pair = pinPairInMm(board, pinA, pinB);
  return pair?.hasLibraryPads ? pair.mm : undefined;
}

export function scaleFromPins(
  doc: BoardDoc,
  {
    componentId,
    pinA,
    pinB,
    targetA,
    targetB,
    mm,
  }: {
    componentId: string;
    pinA: PhysicalPin;
    pinB: PhysicalPin;
    targetA: Vec2;
    targetB: Vec2;
    mm: number;
  },
): void {
  const component = doc.components.find(({ id }) => id === componentId);
  if (!component) throw new RuleTargetNotFound(componentId);
  const { board } = component;
  if (!board) throw new RuleRejected('not_placed');
  if (pinA.id === pinB.id) throw new RuleRejected('pins_coincide');
  const pair = pinPairInMm(board, pinA, pinB);
  if (!pair) throw new RuleRejected('pins_coincide');
  if (!pair.hasLibraryPads) throw new RuleRejected('scale_needs_library_pads');
  if (pair.mm === 0) throw new RuleRejected('pins_coincide');
  if (Math.abs(pair.mm - mm) > 1e-6) throw new RuleRejected('scale_basis_changed');

  const { a, b } = pair;
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
