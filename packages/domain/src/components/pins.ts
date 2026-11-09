import type { ComponentKind } from '../model/component';

const pinCounts: Record<ComponentKind, number> = {
  resistor: 2,
  capacitor: 2,
  capacitor_polarized: 2,
  inductor: 2,
  diode: 2,
  led: 2,
  zener: 2,
  npn: 3,
  pnp: 3,
  nmos: 3,
  pmos: 3,
  regulator: 3,
  ic: 0,
  connector: 0,
  crystal: 2,
  switch: 0,
  fuse: 2,
  testpoint: 1,
  via: 1,
  pad: 1,
  wire_point: 1,
  hole: 0,
  other: 0,
};

export function defaultPinIds(kind: ComponentKind, pinCount?: number): string[] {
  if (kind === 'hole') return [];
  const count = pinCount ?? pinCounts[kind];
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid pin count');
  return Array.from({ length: count }, (_, index) => String(index + 1));
}
