import { expect, test } from 'vitest';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { COMPONENT_LIBRARY } from './contract';

// Counts from the prototype generators, with BB's additional unknown entry.
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
  custom: 8,
  unknown: 0,
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

test('custom library entry exposes the supported layout choices and dimensions', () => {
  expect(COMPONENT_LIBRARY.find(({ id }) => id === 'custom')).toEqual({
    id: 'custom',
    kind: 'ic',
    category: 'misc',
    footprint: 'custom',
    kw: 'custom kohandatud generic moodul',
    params: { layout: 'two_rows', pins: 8, pitch: 2.54, w: 8, h: 10 },
    paramSpec: [
      { key: 'layout', label: 'layout', choices: ['two_rows', 'one_row', 'four_sides', 'empty'] },
      { key: 'pins', label: 'pins', min: 0, max: 200, step: 1 },
      { key: 'pitch', label: 'pitchMm', min: 0.3, max: 10, step: 0.01 },
      { key: 'w', label: 'width', min: 1, max: 200, step: 0.1 },
      { key: 'h', label: 'height', min: 1, max: 200, step: 0.1 },
    ],
  });
});
