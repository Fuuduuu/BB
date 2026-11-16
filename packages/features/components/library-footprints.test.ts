import { expect, test } from 'vitest';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { COMPONENT_LIBRARY } from './contract';

// Counts read from the prototype generators, independent of the BB implementations.
const prototypePinCounts: Readonly<Record<string, number>> = {
  r_smd: 2,
  c_smd: 2,
  l_smd: 2,
  f_smd: 2,
  c_tant: 2,
  c_elsmd: 2,
  r_tht: 2,
  c_disc: 2,
  c_el: 2,
  d_smd: 2,
  d_tht: 2,
  led_smd: 2,
  led_tht: 2,
  sot23: 3,
  sot223: 4,
  dpak: 3,
  to92: 3,
  to220: 3,
  soic: 8,
  tssop: 14,
  dip: 8,
  qfp: 44,
  qfn: 33,
  hdr1: 4,
  hdr2: 10,
  jst: 3,
  term: 2,
  usbc: 16,
  musb: 9,
  dcjack: 3,
  xtal: 2,
  xtal_smd: 4,
  btn: 4,
  pot: 3,
  unknown: 0, // prototüübi `custom` paigutused tulevad M1.4-s (oma jalad)
  tp: 1,
  via: 1,
  pad: 1,
  wire: 1,
  hole: 1,
};

test('every_library_entry_matches_prototype_pin_count', () => {
  expect(COMPONENT_LIBRARY.map(({ id }) => id)).toEqual(Object.keys(prototypePinCounts));
  for (const { id, footprint, params } of COMPONENT_LIBRARY) {
    const geometry = footprintGeometry(footprint, params);
    expect(geometry, id).toBeDefined();
    expect(geometry!.pads.length, id).toBe(prototypePinCounts[id]);
  }
});
