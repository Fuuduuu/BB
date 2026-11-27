import { expect, test } from 'vitest';
import { ComponentKindSchema, type ComponentKind, type Pin } from '../model/component';

const schematicModule = './index';

function testPins(names: readonly (string | undefined)[]): Pin[] {
  return names.map((name, index) => ({
    id: String(index + 1),
    uid: `pin_test_${index + 1}`,
    name,
    nc: false,
  }));
}

const kinds = {
  resistor: { id: 'resistor', names: [undefined, undefined] },
  capacitor: { id: 'capacitor', names: [undefined, undefined] },
  capacitor_polarized: { id: 'capacitor_polarized', names: ['+', '-'] },
  inductor: { id: 'inductor', names: [undefined, undefined] },
  diode: { id: 'diode', names: ['A', 'K'] },
  led: { id: 'led', names: ['A', 'K'] },
  zener: { id: 'zener', names: ['A', 'K'] },
  npn: { id: 'npn', names: ['B', 'C', 'E'] },
  pnp: { id: 'pnp', names: ['B', 'C', 'E'] },
  nmos: { id: 'nmos', names: ['G', 'D', 'S'] },
  pmos: { id: 'pmos', names: ['G', 'D', 'S'] },
  regulator: { id: 'box', names: ['IN', 'GND', 'OUT'] },
  ic: { id: 'box', names: ['VCC', 'SDA', 'SCL', 'GND', '1A', '1B', '2A', '2B'] },
  connector: { id: 'box', names: ['VIN', 'GND', 'OUT'] },
  crystal: { id: 'crystal', names: [undefined, undefined] },
  switch: { id: 'switch', names: [undefined, undefined] },
  fuse: { id: 'fuse', names: [undefined, undefined] },
  testpoint: { id: 'terminal', names: [undefined] },
  via: { id: null, names: [undefined] },
  pad: { id: 'terminal', names: [undefined] },
  wire_point: { id: 'terminal', names: [undefined] },
  hole: { id: null, names: [] },
  other: { id: 'box', names: [] },
} as const satisfies Record<
  ComponentKind,
  { id: import('./index').SymbolId | null; names: readonly (string | undefined)[] }
>;

test('symbol_covers_every_kind_on_grid', async () => {
  const { SCHEMATIC_GRID_MM, schematicSymbol, symbolToSchematic }: typeof import('./index') =
    await import(schematicModule);
  expect(ComponentKindSchema.options).toHaveLength(23);
  expect(SCHEMATIC_GRID_MM).toBe(2.54);
  const at = { x: 50.8, y: 25.4 };
  const assertOnGrid = ({ x, y }: { x: number; y: number }) => {
    for (const value of [x, y]) {
      const units = value / SCHEMATIC_GRID_MM;
      expect(units).toBeCloseTo(Math.round(units));
    }
  };

  for (const kind of ComponentKindSchema.options) {
    const { id, names } = kinds[kind];
    const symbol = schematicSymbol({ kind, pins: testPins(names) });
    if (id === null) {
      expect(symbol, kind).toBeNull();
      continue;
    }
    expect(symbol?.id, kind).toBe(id);
    expect(symbol?.pins, kind).toHaveLength(names.length);
    for (const pin of symbol!.pins) {
      assertOnGrid(pin.end);
      for (const rot of [0, 90, 180, 270] as const) {
        for (const mirror of [false, true]) {
          assertOnGrid(symbolToSchematic({ at, rot, mirror }, pin.end));
        }
      }
    }
    if (id === 'box') {
      const texts = symbol!.prims.flatMap((prim) => (prim.kind === 'text' ? [prim.text] : []));
      expect(texts).toHaveLength(names.length * 2);
      names.forEach((name, index) => {
        expect(texts).toContain(String(index + 1));
        expect(texts).toContain(name);
      });
    }
  }

  const rotated = symbolToSchematic({ at, rot: 90, mirror: false }, { x: 1, y: 0 });
  expect(rotated.x).toBeCloseTo(at.x);
  expect(rotated.y).toBeCloseTo(at.y + 1);
  const mirrored = symbolToSchematic({ at, rot: 90, mirror: true }, { x: 1, y: 0 });
  expect(mirrored.x).toBeCloseTo(at.x);
  expect(mirrored.y).toBeCloseTo(at.y - 1);
});

test('symbol_contacts_from_pin_map_or_names', async () => {
  const { schematicSymbol }: typeof import('./index') = await import(schematicModule);
  const npn = { kind: 'npn' as const, pins: testPins(['E', ' b ', 'C']) };
  const contacts = (component: Parameters<typeof schematicSymbol>[0]) =>
    schematicSymbol(component)?.pins.map(({ contact, pinId }) => [contact, pinId]);

  expect(contacts(npn)).toEqual([
    ['B', '2'],
    ['C', '3'],
    ['E', '1'],
  ]);
  expect(schematicSymbol({ ...npn, pins: testPins([undefined, undefined, undefined]) })?.id).toBe(
    'box',
  );
  expect(contacts({ ...npn, schematic: { pinMap: { B: '1', C: '2', E: '3' } } })).toEqual([
    ['B', '1'],
    ['C', '2'],
    ['E', '3'],
  ]);
  const invalidMaps: Record<string, string>[] = [
    { B: '1', C: 'missing', E: '3' },
    { B: '1', C: '1', E: '3' },
    { B: '1', C: '2' },
  ];
  for (const pinMap of invalidMaps) {
    expect(schematicSymbol({ ...npn, schematic: { pinMap } })?.id).toBe('box');
  }
  expect(contacts({ kind: 'diode', pins: testPins(['K', 'A']) })).toEqual([
    ['A', '2'],
    ['K', '1'],
  ]);
  expect(contacts({ kind: 'led', pins: testPins(['+', '−']) })).toEqual([
    ['A', '1'],
    ['K', '2'],
  ]);
  expect(contacts({ kind: 'capacitor_polarized', pins: testPins(['−', '+']) })).toEqual([
    ['+', '2'],
    ['-', '1'],
  ]);
  expect(contacts({ kind: 'resistor', pins: testPins([undefined, undefined]) })).toEqual([
    ['1', '1'],
    ['2', '2'],
  ]);
  expect(schematicSymbol({ ...npn, pins: testPins(['E', 'B', 'C', 'B']) })?.id).toBe('box');
  expect(schematicSymbol({ kind: 'switch', pins: testPins(['1', '2', '3']) })?.id).toBe('box');
});

test('symbol_label_clears_body_and_box_fits_names', async () => {
  const { SCHEMATIC_GRID_MM, schematicSymbol }: typeof import('./index') = await import(
    schematicModule
  );
  const symbols = ComponentKindSchema.options.flatMap((kind) => {
    const symbol = schematicSymbol({ kind, pins: testPins(kinds[kind].names) });
    return symbol ? [symbol] : [];
  });
  expect(new Set(symbols.map(({ id }) => id)).size).toBe(16);
  const minClearance = Math.min(...symbols.map(({ label, bounds }) => bounds.min.y - label.y));
  expect.soft(minClearance).toBeCloseTo(2.54, 10);

  const wide = schematicSymbol({ kind: 'ic', pins: testPins(['RESET', 'VCC_IO']) })!;
  expect(wide.id).toBe('box');
  expect.soft(wide.bounds.min.x).toBeCloseTo(-10.16);
  expect.soft(wide.bounds.max.x).toBeCloseTo(10.16);
  expect.soft(wide.pins.map(({ end }) => end.x)).toEqual([-12.7, 12.7]);

  const texts = wide.prims.filter((prim) => prim.kind === 'text');
  const left = texts.find(({ text }) => text === 'RESET')!;
  const right = texts.find(({ text }) => text === 'VCC_IO')!;
  expect(left.anchor).toBe('start');
  expect(right.anchor).toBe('end');
  const width = (text: string, size: number) => Array.from(text).length * size * 0.72;
  const gap =
    right.at.x - width(right.text, right.size) - (left.at.x + width(left.text, left.size));
  expect.soft(gap).toBeGreaterThanOrEqual(1.27);

  const standard = schematicSymbol({ kind: 'ic', pins: testPins(['VCC', 'GND']) })!;
  expect(standard.bounds.min.x).toBeCloseTo(-5.08);
  expect(standard.bounds.max.x).toBeCloseTo(5.08);
  for (const { end } of [...wide.pins, ...standard.pins]) {
    for (const mm of [end.x, end.y]) {
      const steps = mm / SCHEMATIC_GRID_MM;
      expect(steps).toBeCloseTo(Math.round(steps));
    }
  }
});
