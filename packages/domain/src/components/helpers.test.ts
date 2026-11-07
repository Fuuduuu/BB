import { expect, test } from 'vitest';
import * as domain from '../index';
import type { Component, ComponentKind } from '../index';

function withRefs(refs: string[]) {
  expect(domain.newBoardDoc).toBeTypeOf('function');
  const doc = domain.newBoardDoc('Tähised');
  doc.components = refs.map((ref, index): Component => ({
    id: `cmp_${index}`,
    ref,
    kind: 'resistor',
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: [],
  }));
  return doc;
}

test('nextRef fills the smallest gap and compares references without case', () => {
  const doc = withRefs(['r1', 'R3', 'C1', 'U1', 'VIA1', 'W1']);
  expect(domain.nextRef(doc, 'resistor')).toBe('R2');
  expect(domain.nextRef(doc, 'capacitor_polarized')).toBe('C2');
  expect(domain.nextRef(doc, 'regulator')).toBe('U2');
  expect(domain.nextRef(doc, 'via')).toBe('VIA2');
  expect(domain.nextRef(doc, 'wire_point')).toBe('W2');
  expect(doc.components.map((component) => component.ref)).toEqual([
    'r1',
    'R3',
    'C1',
    'U1',
    'VIA1',
    'W1',
  ]);
});

test('all component kinds get their documented reference prefix', () => {
  const doc = withRefs([]);
  const cases: [ComponentKind, string][] = [
    ['resistor', 'R'],
    ['capacitor', 'C'],
    ['capacitor_polarized', 'C'],
    ['inductor', 'L'],
    ['diode', 'D'],
    ['led', 'D'],
    ['zener', 'D'],
    ['npn', 'Q'],
    ['pnp', 'Q'],
    ['nmos', 'Q'],
    ['pmos', 'Q'],
    ['regulator', 'U'],
    ['ic', 'U'],
    ['connector', 'J'],
    ['crystal', 'Y'],
    ['switch', 'SW'],
    ['fuse', 'F'],
    ['testpoint', 'TP'],
    ['via', 'VIA'],
    ['pad', 'PAD'],
    ['wire_point', 'W'],
    ['hole', 'H'],
    ['other', 'X'],
  ];
  for (const [kind, prefix] of cases) {
    expect(domain.refPrefix(kind)).toBe(prefix);
    expect(domain.nextRef(doc, kind)).toBe(`${prefix}1`);
  }
});

test('default pin lists cover two-pin, three-pin, single-pin and variable components', () => {
  expect(domain.defaultPinIds).toBeTypeOf('function');
  for (const kind of [
    'resistor',
    'capacitor',
    'capacitor_polarized',
    'inductor',
    'diode',
    'led',
    'zener',
    'fuse',
    'crystal',
  ] as const) {
    expect(domain.defaultPinIds(kind)).toEqual(['1', '2']);
  }
  for (const kind of ['npn', 'pnp', 'nmos', 'pmos', 'regulator'] as const) {
    expect(domain.defaultPinIds(kind)).toEqual(['1', '2', '3']);
  }
  for (const kind of ['testpoint', 'via', 'pad', 'wire_point'] as const) {
    expect(domain.defaultPinIds(kind)).toEqual(['1']);
  }
  for (const kind of ['ic', 'connector', 'switch', 'hole', 'other'] as const) {
    expect(domain.defaultPinIds(kind)).toEqual([]);
  }
  expect(domain.defaultPinIds('ic', 8)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  expect(domain.defaultPinIds('connector', 0)).toEqual([]);
  expect(domain.defaultPinIds('hole', 8)).toEqual([]);
});

test.each([-1, 1.5, NaN, Infinity])('invalid pin count %s is rejected', (count) => {
  expect(domain.defaultPinIds).toBeTypeOf('function');
  expect(() => domain.defaultPinIds('ic', count)).toThrow(RangeError);
});
