import type { ComponentKind, FootprintParams } from '@pcbk/domain';

export type LibraryCategory = 'pass' | 'semi' | 'ic' | 'conn' | 'misc' | 'point';

export type ParamSpec =
  | { key: string; label: string; choices: readonly (string | number)[] }
  | { key: string; label: string; min: number; max: number; step: number };

export interface LibraryEntry {
  id: string;
  kind: ComponentKind;
  footprint: string;
  params: FootprintParams;
  kw: string;
  category: LibraryCategory;
  /** Translation keys resolved by the UI; the contract does not depend on UI strings. */
  paramSpec: readonly ParamSpec[];
}

type LibraryRow = [string, ComponentKind, string, FootprintParams, string, (readonly ParamSpec[])?];

function entries(category: LibraryCategory, rows: readonly LibraryRow[]): LibraryEntry[] {
  return rows.map(([id, kind, footprint, params, kw, paramSpec = []]) => ({
    id,
    kind,
    footprint,
    params,
    kw,
    category,
    paramSpec,
  }));
}

function choice(key: string, choices: readonly (string | number)[], label = key): ParamSpec {
  return { key, label, choices };
}

function range(key: string, min: number, max: number, step: number, label = key): ParamSpec {
  return { key, label, min, max, step };
}

const chipSpec = [choice('size', ['0402', '0603', '0805', '1206', '1210', '2010', '2512'], 'case')];

export const COMPONENT_LIBRARY: readonly LibraryEntry[] = [
  ...entries('pass', [
    ['r_smd', 'resistor', 'chip', { size: '0805' }, 'resistor chip', chipSpec],
    ['c_smd', 'capacitor', 'chip', { size: '0805' }, 'capacitor mlcc', chipSpec],
    ['l_smd', 'inductor', 'chip', { size: '1210' }, 'inductor drossel', chipSpec],
    ['f_smd', 'fuse', 'chip', { size: '1206' }, 'fuse sulavkaitse', chipSpec],
    [
      'c_tant',
      'capacitor_polarized',
      'chip_tant',
      { case: 'B' },
      'tantalum',
      [choice('case', ['A', 'B', 'C', 'D'])],
    ],
    [
      'c_elsmd',
      'capacitor_polarized',
      'el_smd',
      { D: 6.3 },
      'electrolytic',
      [choice('D', [4, 5, 6.3, 8, 10], 'diameter')],
    ],
    [
      'r_tht',
      'resistor',
      'axial',
      { pitch: 10.16, bl: 6.3, bd: 2.5, band: 'ei' },
      'resistor axial',
      [choice('pitch', [7.62, 10.16, 12.7])],
    ],
    [
      'c_disc',
      'capacitor',
      'disc',
      { pitch: 5.08 },
      'ceramic disc',
      [choice('pitch', [2.54, 5.08])],
    ],
    [
      'c_el',
      'capacitor_polarized',
      'radial',
      { D: 6.3, pitch: 2.5 },
      'electrolytic radial',
      [choice('D', [5, 6.3, 8, 10, 13], 'diameter'), choice('pitch', [2, 2.5, 3.5, 5])],
    ],
  ]),
  ...entries('semi', [
    [
      'd_smd',
      'diode',
      'chip_diode',
      { case: 'SOD-123' },
      'diode schottky',
      [choice('case', ['SOD-323', 'SOD-123', 'SMA', 'SMB', 'SMC'])],
    ],
    ['d_tht', 'diode', 'axial', { pitch: 10.16, bl: 5.2, bd: 2.7, band: 'jah' }, 'diode do-41'],
    [
      'led_smd',
      'led',
      'chip_led',
      { size: '0805' },
      'led',
      [choice('size', ['0603', '0805', '1206'], 'case')],
    ],
    ['led_tht', 'led', 'led_tht', { D: 5 }, 'led', [choice('D', [3, 5], 'diameter')]],
    ['sot23', 'npn', 'sot23', { pins: 3 }, 'transistor mosfet', [choice('pins', [3, 5, 6])]],
    ['sot223', 'regulator', 'sot223', {}, 'regulator'],
    ['dpak', 'npn', 'dpak', {}, 'to-252 mosfet'],
    ['to92', 'npn', 'to92', {}, 'transistor'],
    ['to220', 'regulator', 'to220', {}, 'regulator mosfet'],
  ]),
  ...entries('ic', [
    [
      'soic',
      'ic',
      'soic',
      { pins: 8, body: 3.9 },
      'so ic',
      [choice('pins', [8, 14, 16, 20, 24, 28]), choice('body', [3.9, 7.5])],
    ],
    [
      'tssop',
      'ic',
      'sop',
      { pins: 14, pitch: 0.65 },
      'ic',
      [choice('pins', [8, 10, 14, 16, 20, 24, 28]), choice('pitch', [0.65, 0.5])],
    ],
    [
      'dip',
      'ic',
      'dip',
      { pins: 8, row: 7.62 },
      'ic tht',
      [choice('pins', [4, 6, 8, 14, 16, 18, 20, 24, 28, 40]), choice('row', [7.62, 15.24])],
    ],
    [
      'qfp',
      'ic',
      'qfp',
      { pins: 44, pitch: 0.8, body: 0 },
      'lqfp tqfp mcu',
      [
        choice('pins', [32, 44, 48, 64, 80, 100]),
        choice('pitch', [0.8, 0.65, 0.5]),
        range('body', 0, 40, 0.1, 'autoBody'),
      ],
    ],
    [
      'qfn',
      'ic',
      'qfn',
      { pins: 32, pitch: 0.5, ep: 'jah', body: 0 },
      'dfn mlf',
      [
        choice('pins', [16, 20, 24, 28, 32, 48, 64]),
        choice('pitch', [0.65, 0.5, 0.4]),
        choice('ep', ['jah', 'ei']),
        range('body', 0, 20, 0.1, 'autoBody'),
      ],
    ],
  ]),
  ...entries('conn', [
    [
      'hdr1',
      'connector',
      'header1',
      { pins: 4, pitch: 2.54 },
      'header pin',
      [range('pins', 1, 40, 1), choice('pitch', [2.54, 2, 1.27])],
    ],
    [
      'hdr2',
      'connector',
      'header2',
      { pins: 5, pitch: 2.54 },
      'header idc',
      [range('pins', 1, 40, 1, 'pairs'), choice('pitch', [2.54, 2, 1.27])],
    ],
    [
      'jst',
      'connector',
      'jst',
      { series: 'XH 2.5', pins: 3 },
      'xh ph sh connector',
      [choice('series', ['XH 2.5', 'PH 2.0', 'SH 1.0']), range('pins', 1, 16, 1)],
    ],
    [
      'term',
      'connector',
      'terminal',
      { pins: 2, pitch: 5 },
      'terminal block',
      [range('pins', 1, 12, 1), choice('pitch', [5, 5.08, 3.5])],
    ],
    ['usbc', 'connector', 'usb_c', {}, 'type-c usb'],
    ['musb', 'connector', 'micro_usb', {}, 'usb'],
    ['dcjack', 'connector', 'dc_jack', {}, 'barrel jack power'],
  ]),
  ...entries('misc', [
    ['xtal', 'crystal', 'xtal', {}, 'crystal'],
    ['xtal_smd', 'crystal', 'xtal_smd', {}, 'crystal 3225'],
    ['btn', 'switch', 'button', {}, 'button switch tact'],
    ['pot', 'resistor', 'trimmer', {}, 'potentiometer'],
    [
      'custom',
      'ic',
      'custom',
      { layout: 'two_rows', pins: 8, pitch: 2.54, w: 8, h: 10 },
      'custom kohandatud generic moodul',
      [
        choice('layout', ['two_rows', 'one_row', 'four_sides', 'empty']),
        range('pins', 0, 200, 1),
        range('pitch', 0.3, 10, 0.01, 'pitchMm'),
        range('w', 1, 200, 0.1, 'width'),
        range('h', 1, 200, 0.1, 'height'),
      ],
    ],
    ['unknown', 'other', 'area', { w: 8, h: 10 }, 'unknown generic custom moodul'],
  ]),
  ...entries('point', [
    ['tp', 'testpoint', 'point', { type: 'tp' }, 'test point'],
    ['via', 'via', 'point', { type: 'via' }, 'via läbiviik'],
    [
      'pad',
      'pad',
      'point',
      { shape: 'ümar', size: 1.6, type: 'pad' },
      'pad',
      [choice('shape', ['ümar', 'nelinurk']), range('size', 0.2, 20, 0.1, 'sizeMm')],
    ],
    ['wire', 'wire_point', 'point', { type: 'wire' }, 'wire juhe'],
    [
      'hole',
      'hole',
      'point',
      { D: 3.2, type: 'hole' },
      'mounting hole',
      [choice('D', [2.2, 3.2, 4.3], 'hole')],
    ],
  ]),
];
