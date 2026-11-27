import type { Component, Pin, SymbolPlacement } from '../model/component';
import type { Vec2 } from '../model/primitives';
import { rectangle, shapes } from './geometry';
import type { SymbolContact } from './geometry';
import { MONO_ADVANCE_EM, SCHEMATIC_GRID_MM as grid } from './types';
import type { SchematicSymbol, SymbolId, SymbolPin, SymbolPrim } from './types';

export { MONO_ADVANCE_EM, SCHEMATIC_GRID_MM } from './types';
export type { SchematicSymbol, SymbolId, SymbolPin, SymbolPrim } from './types';

const symbolOf = {
  resistor: 'resistor',
  capacitor: 'capacitor',
  capacitor_polarized: 'capacitor_polarized',
  inductor: 'inductor',
  diode: 'diode',
  led: 'led',
  zener: 'zener',
  npn: 'npn',
  pnp: 'pnp',
  nmos: 'nmos',
  pmos: 'pmos',
  regulator: 'box',
  ic: 'box',
  connector: 'box',
  crystal: 'crystal',
  switch: 'switch',
  fuse: 'fuse',
  testpoint: 'terminal',
  via: null,
  pad: 'terminal',
  wire_point: 'terminal',
  hole: null,
  other: 'box',
} as const satisfies Record<Component['kind'], SymbolId | null>;

const namesByContact: Readonly<Partial<Record<SymbolId, Record<string, string[]>>>> = {
  capacitor_polarized: { '+': ['+'], '-': ['-', '−'] },
  diode: { A: ['A', '+'], K: ['K', '-', '−'] },
  led: { A: ['A', '+'], K: ['K', '-', '−'] },
  zener: { A: ['A', '+'], K: ['K', '-', '−'] },
  npn: { B: ['B'], C: ['C'], E: ['E'] },
  pnp: { B: ['B'], C: ['C'], E: ['E'] },
  nmos: { G: ['G'], D: ['D'], S: ['S'] },
  pmos: { G: ['G'], D: ['D'], S: ['S'] },
};

function resolveContacts(
  id: keyof typeof shapes,
  contacts: readonly SymbolContact[],
  pins: readonly Readonly<Pin>[],
  pinMap: Readonly<SymbolPlacement['pinMap']>,
): SymbolPin[] | null {
  if (pins.length !== contacts.length) return null;
  if (pinMap !== undefined) {
    const pinIds = new Set(pins.map((pin) => pin.id));
    const used = new Set<string>();
    const mapped = [];
    for (const contact of contacts) {
      if (!Object.hasOwn(pinMap, contact.contact)) return null;
      const pinId = pinMap[contact.contact]!;
      if (!pinIds.has(pinId) || used.has(pinId)) return null;
      used.add(pinId);
      mapped.push({ ...contact, pinId });
    }
    return mapped;
  }
  const names = namesByContact[id];
  if (!names) return contacts.map((contact, index) => ({ ...contact, pinId: pins[index]!.id }));
  const mapped = [];
  for (const contact of contacts) {
    const accepted = names[contact.contact]!;
    const matching = pins.filter((pin) =>
      accepted.includes(pin.name?.replace(/\s/g, '').toUpperCase() ?? ''),
    );
    if (matching.length !== 1) return null;
    mapped.push({ ...contact, pinId: matching[0]!.id });
  }
  return mapped;
}

function freezeGeometry<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeGeometry(child);
    Object.freeze(value);
  }
  return value;
}

function makeSymbol(
  id: SymbolId,
  prims: readonly SymbolPrim[],
  pins: readonly SymbolPin[],
  bounds: SchematicSymbol['bounds'],
): SchematicSymbol {
  return freezeGeometry({ id, prims, pins, bounds, label: { x: 0, y: bounds.min.y - grid } });
}

function primitiveBounds(prims: readonly SymbolPrim[]): SchematicSymbol['bounds'] {
  const points = prims.flatMap((prim) => {
    if (prim.kind === 'line') return prim.points;
    if (prim.kind === 'circle') {
      const { x, y } = prim.at;
      return [
        { x: x - prim.r, y: y - prim.r },
        { x: x + prim.r, y: y + prim.r },
      ];
    }
    return [prim.at];
  });
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

function box(pins: readonly Readonly<Pin>[], connector: boolean): SchematicSymbol {
  const leftCount = connector ? pins.length : Math.ceil(pins.length / 2);
  const leftPins = pins.slice(0, leftCount);
  const rightPins = pins.slice(leftCount);
  const nameFontSize = 1.8;
  const nameInset = 0.55;
  const longestName = (sidePins: readonly Readonly<Pin>[]) =>
    sidePins.reduce((length, pin) => Math.max(length, Array.from(pin.name ?? '').length), 0);
  const requiredWidth =
    (longestName(leftPins) + longestName(rightPins)) * MONO_ADVANCE_EM * nameFontSize +
    2 * nameInset +
    grid / 2;
  const halfWidth = Math.max(2 * grid, Math.ceil(requiredWidth / (2 * grid)) * grid);
  const symbolPins: SymbolPin[] = [];
  const texts: SymbolPrim[] = [];
  let minY = 0;
  let maxY = 0;
  function placeSide(side: -1 | 1, sidePins: readonly Readonly<Pin>[]) {
    const centerIndex = Math.floor((sidePins.length - 1) / 2);
    sidePins.forEach((pin, index) => {
      const y = (index - centerIndex) * grid;
      const inner = { x: side * halfWidth, y };
      const end = { x: side * (halfWidth + grid), y };
      symbolPins.push({ contact: pin.id, pinId: pin.id, inner, end });
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      texts.push({
        kind: 'text',
        at: { x: (inner.x + end.x) / 2, y: y - 1 },
        text: pin.id,
        size: 1.5,
        anchor: 'middle',
      });
      if (pin.name) {
        texts.push({
          kind: 'text',
          at: { x: inner.x - side * nameInset, y: y + 0.6 },
          text: pin.name,
          size: nameFontSize,
          anchor: side === -1 ? 'start' : 'end',
        });
      }
    });
  }
  placeSide(-1, leftPins);
  placeSide(1, rightPins);
  const min = { x: -halfWidth, y: minY - grid };
  const max = { x: halfWidth, y: maxY + grid };
  return makeSymbol('box', [rectangle(min.x, min.y, max.x, max.y), ...texts], symbolPins, {
    min,
    max,
  });
}

export function schematicSymbol(
  component: Readonly<Pick<Component, 'kind'>> & {
    readonly pins: readonly Readonly<Pin>[];
    readonly schematic?: Readonly<Pick<SymbolPlacement, 'pinMap'>>;
  },
): SchematicSymbol | null {
  const id = symbolOf[component.kind];
  if (id === null) return null;
  if (id === 'box') return box(component.pins, component.kind === 'connector');
  const { contacts, prims } = shapes[id];
  const pins = resolveContacts(id, contacts, component.pins, component.schematic?.pinMap);
  if (!pins) return box(component.pins, false);
  return makeSymbol(id, prims, pins, primitiveBounds(prims));
}

export function symbolToSchematic(
  { at, rot, mirror }: Pick<SymbolPlacement, 'at' | 'rot' | 'mirror'>,
  local: Readonly<Vec2>,
): Vec2 {
  const x = mirror ? -local.x : local.x;
  const { y } = local;
  switch (rot) {
    case 0:
      return { x: at.x + x, y: at.y + y };
    case 90:
      return { x: at.x - y, y: at.y + x };
    case 180:
      return { x: at.x - x, y: at.y - y };
    case 270:
      return { x: at.x + y, y: at.y - x };
  }
}
