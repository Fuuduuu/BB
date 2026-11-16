import { body, numberChoice, numberRange, pad } from './helpers';
import { defineFootprint, type FootprintDef, type FootprintParams, type PadGeom } from './types';

export const sopFootprint = defineFootprint(
  'sop',
  'TSSOP / MSOP',
  { pins: 14, pitch: 0.65 },
  (params) => {
    const pins = numberChoice(params.pins, [8, 10, 14, 16, 20, 24, 28]),
      pitch = numberChoice(params.pitch, [0.65, 0.5]);
    if (pins === undefined || pitch === undefined) return undefined;
    const bw = pitch < 0.6 ? 3 : 4.4,
      pl = 1.4,
      n = pins / 2,
      pc = bw / 2 + pl / 2 + 0.05,
      y0 = (-(n - 1) / 2) * pitch,
      h = n * pitch - 0.2 + 0.6;
    const pads = Array.from({ length: pins }, (_, index) => {
      const left = index < n,
        row = left ? index : pins - 1 - index;
      return pad(index + 1, left ? -pc : pc, y0 + row * pitch, pl, pitch * 0.6);
    });
    return { pads, body: body(bw, h, { x: -bw / 2 + 0.6, y: -h / 2 + 0.6 }) };
  },
);

export const dipFootprint = defineFootprint('dip', 'DIP', { pins: 8, row: 7.62 }, (params) => {
  const pins = numberChoice(params.pins, [4, 6, 8, 14, 16, 18, 20, 24, 28, 40]),
    row = numberChoice(params.row, [7.62, 15.24]);
  if (pins === undefined || row === undefined) return undefined;
  const n = pins / 2,
    y0 = (-(n - 1) / 2) * 2.54;
  const pads = Array.from({ length: pins }, (_, index) => {
    const left = index < n,
      i = left ? index : pins - 1 - index;
    return pad(
      index + 1,
      left ? -row / 2 : row / 2,
      y0 + i * 2.54,
      1.6,
      1.6,
      index === 0 ? 'rect' : 'circle',
      0.8,
    );
  });
  return { pads, body: body(row - 1.27, n * 2.54 + 0.3) };
});

function quadFootprint(kind: 'qfp' | 'qfn'): FootprintDef {
  const qfn = kind === 'qfn';
  const defaults: FootprintParams = qfn
    ? { pins: 32, pitch: 0.5, ep: 'jah', body: 0 }
    : { pins: 44, pitch: 0.8, body: 0 };
  return defineFootprint(kind, kind.toUpperCase(), defaults, (params) => {
    const pins = numberChoice(
      params.pins,
      qfn ? [16, 20, 24, 28, 32, 48, 64] : [32, 44, 48, 64, 80, 100],
    );
    const pitch = numberChoice(params.pitch, qfn ? [0.65, 0.5, 0.4] : [0.8, 0.65, 0.5]);
    const size = numberRange(params.body, 0, qfn ? 20 : 40);
    if (
      pins === undefined ||
      pitch === undefined ||
      size === undefined ||
      (qfn && params.ep !== 'jah' && params.ep !== 'ei')
    )
      return undefined;
    const n = pins / 4,
      B = size > 0 ? size : n * pitch + (qfn ? 1 : 1.2),
      pl = qfn ? 0.8 : 1.5,
      pw = pitch * 0.55,
      pc = qfn ? B / 2 - 0.25 : B / 2 + 0.75;
    const pads: PadGeom[] = [];
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * pitch;
      pads.push(
        pad(1 + k, -pc, off, pl, pw),
        pad(1 + n + k, off, pc, pw, pl),
        pad(1 + 2 * n + k, pc, -off, pl, pw),
        pad(1 + 3 * n + k, -off, -pc, pw, pl),
      );
    }
    pads.sort((a, b) => Number(a.id) - Number(b.id));
    if (qfn && params.ep === 'jah')
      pads.push(pad(4 * n + 1, 0, 0, B * 0.55, B * 0.55, 'rect', 0, 'EP'));
    return { pads, body: body(B, B, { x: -B / 2 + 0.8, y: -B / 2 + 0.8 }) };
  });
}
export const qfpFootprint = quadFootprint('qfp');
export const qfnFootprint = quadFootprint('qfn');
