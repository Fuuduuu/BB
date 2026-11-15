import { body, numberChoice, numberRange, pad } from './helpers';
import { defineFootprint, type PadGeom } from './types';

export const header2Footprint = defineFootprint(
  'header2',
  '2×N',
  { pins: 5, pitch: 2.54 },
  (params) => {
    const pairs = numberRange(params.pins, 1, 40, true),
      pitch = numberChoice(params.pitch, [2.54, 2, 1.27]);
    if (pairs === undefined || pitch === undefined) return undefined;
    const pd = pitch * 0.68,
      drill = pitch * 0.4;
    const pads = Array.from({ length: pairs * 2 }, (_, i) => {
      const x = (Math.floor(i / 2) - (pairs - 1) / 2) * pitch;
      return pad(
        i + 1,
        x,
        i % 2 === 0 ? pitch / 2 : -pitch / 2,
        pd,
        pd,
        i === 0 ? 'rect' : 'circle',
        drill,
      );
    });
    return { pads, body: body(pairs * pitch, 2 * pitch) };
  },
);

type JstSeries = { pitch: number; pad: number; drill: number; extra: number; h: number };
const jst: Readonly<Record<string, JstSeries>> = {
  'XH 2.5': { pitch: 2.5, pad: 1.7, drill: 1, extra: 4.9, h: 5.75 },
  'PH 2.0': { pitch: 2, pad: 1.2, drill: 0.7, extra: 3.9, h: 4.5 },
};
export const jstFootprint = defineFootprint(
  'jst',
  'JST pistik',
  { series: 'XH 2.5', pins: 3 },
  (params) => {
    const pins = numberRange(params.pins, 1, 16, true),
      series = params.series;
    if (
      pins === undefined ||
      typeof series !== 'string' ||
      (series !== 'SH 1.0' && !Object.hasOwn(jst, series))
    )
      return undefined;
    if (series === 'SH 1.0') {
      const pads = Array.from({ length: pins }, (_, i) =>
        pad(i + 1, i - (pins - 1) / 2, -1.6, 0.6, 1.55),
      );
      const mx = (pins - 1) / 2 + 1.35;
      pads.push(pad('MP1', -mx, 1.2, 1.2, 1.8), pad('MP2', mx, 1.2, 1.2, 1.8));
      return { pads, body: body(pins - 1 + 3.6, 3.2) };
    }
    const s = jst[series]!;
    const pads = Array.from({ length: pins }, (_, i) =>
      pad(
        i + 1,
        (i - (pins - 1) / 2) * s.pitch,
        0,
        s.pad,
        s.pad,
        i === 0 ? 'rect' : 'circle',
        s.drill,
      ),
    );
    return { pads, body: body((pins - 1) * s.pitch + s.extra, s.h) };
  },
);

export const terminalFootprint = defineFootprint(
  'terminal',
  'Kruviklemm',
  { pins: 2, pitch: 5 },
  (params) => {
    const pins = numberRange(params.pins, 1, 12, true),
      pitch = numberChoice(params.pitch, [5, 5.08, 3.5]);
    if (pins === undefined || pitch === undefined) return undefined;
    const pd = pitch * 0.52,
      drill = pitch * 0.26;
    const pads = Array.from({ length: pins }, (_, i) =>
      pad(i + 1, (i - (pins - 1) / 2) * pitch, 0, pd, pd, i === 0 ? 'rect' : 'circle', drill),
    );
    return { pads, body: body(pins * pitch, pitch * 1.6) };
  },
);

export const usbCFootprint = defineFootprint('usb_c', 'USB-C', {}, () => {
  const contacts: readonly [string, number, number][] = [
    ['A1B12', -3.2, 0.6],
    ['A4B9', -2.4, 0.6],
    ['B8', -1.75, 0.3],
    ['A5', -1.25, 0.3],
    ['B7', -0.75, 0.3],
    ['A6', -0.25, 0.3],
    ['A7', 0.25, 0.3],
    ['B6', 0.75, 0.3],
    ['A8', 1.25, 0.3],
    ['B5', 1.75, 0.3],
    ['B4A9', 2.4, 0.6],
    ['B1A12', 3.2, 0.6],
  ];
  const pads: PadGeom[] = contacts.map(([id, x, w]) => pad(id, x, -3.85, w, 1.15));
  pads.push(
    pad('S1', -4.32, -2.9, 0.9, 2, 'oval', 0.6),
    pad('S2', 4.32, -2.9, 0.9, 2, 'oval', 0.6),
    pad('S3', -4.32, 1.1, 0.9, 1.7, 'oval', 0.6),
    pad('S4', 4.32, 1.1, 0.9, 1.7, 'oval', 0.6),
  );
  return { pads, body: body(8.94, 7.3) };
});
export const microUsbFootprint = defineFootprint('micro_usb', 'Micro-USB', {}, () => {
  const pads = Array.from({ length: 5 }, (_, i) => pad(i + 1, (i - 2) * 0.65, -2.7, 0.4, 1.35));
  pads.push(
    pad('S1', -3.1, -2.45, 1.6, 1.4),
    pad('S2', 3.1, -2.45, 1.6, 1.4),
    pad('S3', -1.2, 0, 1.9),
    pad('S4', 1.2, 0, 1.9),
  );
  return { pads, body: body(7.5, 5) };
});
export const dcJackFootprint = defineFootprint('dc_jack', 'Toitepesa DC', {}, () => ({
  pads: [
    pad(1, 0, -5.2, 3.2, 1.6, 'oval', 1),
    pad(2, 0, 0.8, 3.2, 1.6, 'oval', 1),
    pad(3, 4.5, -2.2, 1.6, 3.2, 'oval', 1),
  ],
  body: body(9, 14.4),
}));
