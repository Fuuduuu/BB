import type { BoardDoc } from '../model/board';
import type { ComponentKind } from '../model/component';

const prefixes: Record<ComponentKind, string> = {
  resistor: 'R',
  capacitor: 'C',
  capacitor_polarized: 'C',
  inductor: 'L',
  diode: 'D',
  led: 'D',
  zener: 'D',
  npn: 'Q',
  pnp: 'Q',
  nmos: 'Q',
  pmos: 'Q',
  regulator: 'U',
  ic: 'U',
  connector: 'J',
  crystal: 'Y',
  switch: 'SW',
  fuse: 'F',
  testpoint: 'TP',
  via: 'VIA',
  pad: 'PAD',
  wire_point: 'W',
  hole: 'H',
  other: 'X',
};

export function refPrefix(kind: ComponentKind): string {
  return prefixes[kind];
}

export function nextRef(doc: BoardDoc, kind: ComponentKind): string {
  const prefix = refPrefix(kind);
  const used = new Set(doc.components.map((component) => component.ref.toUpperCase()));
  let number = 1;
  while (used.has(`${prefix}${number}`)) number += 1;
  return `${prefix}${number}`;
}
