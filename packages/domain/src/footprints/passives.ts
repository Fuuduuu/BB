import { body, numberChoice, pad } from './helpers';
import { defineFootprint, readNumber, withBodyMarks } from './types';
import type { BodyMarkSpec } from './types';

const electrolyticMarks = [
  { kind: 'plus', pin: '+' },
  { kind: 'band', pin: '−' },
] as const satisfies readonly BodyMarkSpec[];

type ChipSize = readonly [offset: number, padW: number, padH: number, bodyW: number, bodyH: number];
const tantalum: Readonly<Record<string, ChipSize>> = {
  A: [1.4, 1.4, 1.4, 3.2, 1.6],
  B: [1.55, 1.5, 2.3, 3.5, 2.8],
  C: [2.6, 2.2, 2.4, 6, 3.2],
  D: [3.2, 2.5, 2.6, 7.3, 4.3],
};
const diodes: Readonly<Record<string, ChipSize>> = {
  'SOD-323': [1.15, 0.6, 0.5, 1.7, 1.25],
  'SOD-123': [1.65, 0.9, 1.2, 2.7, 1.6],
  SMA: [2, 1.6, 1.6, 4.3, 2.6],
  SMB: [2.15, 2.1, 2.3, 4.6, 3.6],
  SMC: [3.4, 2.5, 3.3, 6.9, 5.9],
};
function chipFamily(
  key: string,
  name: string,
  sizes: Readonly<Record<string, ChipSize>>,
  defaultCase: string,
  names: readonly [string, string],
) {
  return defineFootprint(key, name, { case: defaultCase }, (params) => {
    if (typeof params.case !== 'string' || !Object.hasOwn(sizes, params.case)) return undefined;
    const [c, pw, ph, w, h] = sizes[params.case]!;
    return {
      pads: [pad(1, -c, 0, pw, ph, 'rect', 0, names[0]), pad(2, c, 0, pw, ph, 'rect', 0, names[1])],
      body: body(w, h),
    };
  });
}
export const chipTantFootprint = withBodyMarks(
  chipFamily('chip_tant', 'Tantaal SMD', tantalum, 'B', ['+', '−']),
  [{ kind: 'band', pin: '+' }],
);
export const chipDiodeFootprint = withBodyMarks(
  chipFamily('chip_diode', 'Diood SMD', diodes, 'SOD-123', ['K', 'A']),
  [{ kind: 'band', pin: 'K' }],
);

export const elSmdFootprint = withBodyMarks(
  defineFootprint(
    'el_smd',
    'Elektrolüüt SMD',
    { D: 6.3 },
    (params) => {
      const D = numberChoice(params.D, [4, 5, 6.3, 8, 10]);
      if (D === undefined) return undefined;
      const pc = D * 0.42,
        pw = Math.max(1.4, D * 0.45),
        ph = Math.max(1, D * 0.26);
      return {
        pads: [pad(1, -pc, 0, pw, ph, 'rect', 0, '+'), pad(2, pc, 0, pw, ph, 'rect', 0, '−')],
        body: body(D + 0.3, D + 0.3),
      };
    },
    { shape: 'circle' },
  ),
  electrolyticMarks,
);

export const axialFootprint = withBodyMarks(
  defineFootprint(
    'axial',
    'Aksiaalne',
    { pitch: 10.16, bl: 6.3, bd: 2.5, band: 'ei' },
    (params) => {
      const pitch = readNumber(params.pitch),
        bl = readNumber(params.bl),
        bd = readNumber(params.bd);
      if (
        pitch === undefined ||
        pitch <= 0 ||
        bl === undefined ||
        bl <= 0 ||
        bd === undefined ||
        bd <= 0 ||
        (params.band !== 'jah' && params.band !== 'ei')
      )
        return undefined;
      const diode = params.band === 'jah',
        pd = diode ? 2 : 1.6,
        drill = diode ? 1 : 0.8;
      return {
        pads: [
          pad(1, -pitch / 2, 0, pd, pd, diode ? 'rect' : 'circle', drill, diode ? 'K' : undefined),
          pad(2, pitch / 2, 0, pd, pd, 'circle', drill, diode ? 'A' : undefined),
        ],
        body: body(bl, bd),
      };
    },
  ),
  [{ kind: 'band', pin: 'K' }],
);

export const discFootprint = defineFootprint(
  'disc',
  'Keraamiline kondensaator THT',
  { pitch: 5.08 },
  (params) => {
    const pitch = numberChoice(params.pitch, [2.54, 5.08]);
    if (pitch === undefined) return undefined;
    return {
      pads: [
        pad(1, -pitch / 2, 0, 1.6, 1.6, 'circle', 0.8),
        pad(2, pitch / 2, 0, 1.6, 1.6, 'circle', 0.8),
      ],
      body: body(pitch + 2.2, 2.6),
    };
  },
  { shape: 'oval' },
);

export const radialFootprint = withBodyMarks(
  defineFootprint(
    'radial',
    'Elektrolüüt THT',
    { D: 6.3, pitch: 2.5 },
    (params) => {
      const D = numberChoice(params.D, [5, 6.3, 8, 10, 13]),
        pitch = numberChoice(params.pitch, [2, 2.5, 3.5, 5]);
      if (D === undefined || pitch === undefined) return undefined;
      const pd = Math.min(1.8, pitch * 0.72),
        drill = pd * 0.5;
      return {
        pads: [
          pad(1, -pitch / 2, 0, pd, pd, 'rect', drill, '+'),
          pad(2, pitch / 2, 0, pd, pd, 'circle', drill, '−'),
        ],
        body: body(D, D),
      };
    },
    { shape: 'circle' },
  ),
  electrolyticMarks,
);

export const ledThtFootprint = defineFootprint(
  'led_tht',
  'LED THT',
  { D: 5 },
  (params) => {
    const D = numberChoice(params.D, [3, 5]);
    if (D === undefined) return undefined;
    const r = D / 2 + 0.4;
    return {
      pads: [
        pad(1, -1.27, 0, 1.8, 1.8, 'rect', 0.9, 'K'),
        pad(2, 1.27, 0, 1.8, 1.8, 'circle', 0.9, 'A'),
      ],
      body: body(r * 1.86, r * 2),
    };
  },
  { shape: 'd', flat: '-x' },
);
