import { expect, test } from 'vitest';
import { FOOTPRINTS, footprintGeometry } from './index';
import type { FootprintParams } from './types';

const invalid: [string, FootprintParams][] = [
  ['chip_tant', { case: 'E' }],
  ['chip_tant', { case: 1 }],
  ['chip_tant', { case: 'constructor' }],
  ['chip_diode', { case: 'SOD-999' }],
  ['chip_diode', { case: 1 }],
  ['el_smd', { D: 3 }],
  ['axial', { pitch: 0 }],
  ['axial', { bl: 0 }],
  ['axial', { bd: 0 }],
  ['axial', { band: 'x' }],
  ['disc', { pitch: 3 }],
  ['radial', { D: 4 }],
  ['radial', { pitch: 1 }],
  ['led_tht', { D: 4 }],
  ['sop', { pins: 12 }],
  ['sop', { pitch: 0.6 }],
  ['dip', { pins: 5 }],
  ['dip', { row: 8 }],
  ['qfp', { pins: 36 }],
  ['qfp', { pitch: 0.4 }],
  ['qfp', { body: -0.1 }],
  ['qfp', { body: 40.1 }],
  ['qfn', { pins: 12 }],
  ['qfn', { pitch: 0.3 }],
  ['qfn', { body: -0.1 }],
  ['qfn', { body: 20.1 }],
  ['qfn', { ep: 'x' }],
  ['header2', { pins: 0 }],
  ['header2', { pins: 41 }],
  ['header2', { pins: 1.5 }],
  ['header2', { pitch: 3 }],
  ['jst', { pins: 0 }],
  ['jst', { pins: 17 }],
  ['jst', { pins: 1.5 }],
  ['jst', { series: 'x' }],
  ['jst', { series: 1 }],
  ['jst', { series: 'constructor' }],
  ['terminal', { pins: 0 }],
  ['terminal', { pins: 13 }],
  ['terminal', { pins: 1.5 }],
  ['terminal', { pitch: 4 }],
  ['point', { type: 'x' }],
  ['point', { shape: 'x' }],
  ['point', { size: 0.1 }],
  ['point', { size: 20.1 }],
  ['point', { D: 3 }],
];

test.each(invalid)('%s rejects unsupported parameter values %j', (key, params) => {
  expect(footprintGeometry(key, params)).toBeUndefined();
});
test('new generators reject nondecimal and nonfinite numeric values', () => {
  for (const definition of FOOTPRINTS.slice(6)) {
    for (const [key, value] of Object.entries(definition.defaults)) {
      if (typeof value !== 'number') continue;
      for (const invalid of [Infinity, -Infinity, NaN, '', ' ', 'x', '0x10', '1e0']) {
        expect(
          footprintGeometry(definition.key, { [key]: invalid }),
          `${definition.key}.${key}: ${invalid}`,
        ).toBeUndefined();
      }
    }
  }
});
test('new generators create independent results without changing their parameters', () => {
  for (const definition of FOOTPRINTS.slice(6)) {
    const params = Object.freeze({ ...definition.defaults });
    const first = footprintGeometry(definition.key, params)!;
    const second = footprintGeometry(definition.key, params)!;
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.pads).not.toBe(second.pads);
    expect(first.pads[0]).not.toBe(second.pads[0]);
    expect(first.body).not.toBe(second.body);
    if (first.body.pin1) expect(first.body.pin1).not.toBe(second.body.pin1);
    expect(params).toEqual(definition.defaults);
  }
});
