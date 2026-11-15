import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { footprintGeometry } from './index';
import type { FootprintGeom, FootprintParams } from './types';

type Proto = {
  body: (
    { t: 'rect'; w: number; h: number } | { t: 'circle'; r: number } | { t: 'path'; bb: number[] }
  )[];
  marks: { t: string; x?: number; y?: number }[];
  pins: { id: string; x: number; y: number; w: number; h: number; shape: string; drill: number }[];
};
type Entry = {
  key: string;
  params: { k: string; o?: string[]; n?: number[]; d: string | number }[];
  gen: (p: FootprintParams) => Proto;
};
const source = readFileSync('prototype/src/js/01-footprints.js', 'utf8').split(/\r?\n/);
const prototypeEntries = runInNewContext(
  `${source[5]}\n${source[9]}\n${source.slice(27, 222).join('\n')}\nLIB`,
) as Entry[];
const keys: Record<string, string> = {
  c_tant: 'chip_tant',
  c_elsmd: 'el_smd',
  r_tht: 'axial',
  c_disc: 'disc',
  c_el: 'radial',
  d_smd: 'chip_diode',
  d_tht: 'axial',
  led_tht: 'led_tht',
  sot223: 'sot223',
  dpak: 'dpak',
  to92: 'to92',
  tssop: 'sop',
  dip: 'dip',
  qfp: 'qfp',
  qfn: 'qfn',
  hdr2: 'header2',
  jst: 'jst',
  term: 'terminal',
  usbc: 'usb_c',
  musb: 'micro_usb',
  dcjack: 'dc_jack',
  xtal: 'xtal',
  xtal_smd: 'xtal_smd',
  btn: 'button',
  pot: 'trimmer',
  tp: 'point',
  via: 'point',
  pad: 'point',
  wire: 'point',
  hole: 'point',
};
function paramsFor(id: string, params: FootprintParams): FootprintParams {
  if (id === 'r_tht') return { ...params, bl: 6.3, bd: 2.5, band: 'ei' };
  if (id === 'd_tht') return { pitch: 10.16, bl: 5.2, bd: 2.7, band: 'jah' };
  if (['tp', 'via', 'pad', 'wire', 'hole'].includes(id)) return { ...params, type: id };
  return params;
}
function expectedGeometry(proto: Proto): FootprintGeom {
  const shape = proto.body[0];
  let w = 0,
    h = 0;
  if (shape?.t === 'rect') ({ w, h } = shape);
  if (shape?.t === 'circle') w = h = shape.r * 2;
  if (shape?.t === 'path') {
    w = shape.bb[2]! - shape.bb[0]!;
    h = shape.bb[3]! - shape.bb[1]!;
  }
  const dot = proto.marks.find((mark) => mark.t === 'dot');
  return {
    pads: Array.from(proto.pins, ({ id, x, y, w, h, shape, drill }) => ({
      id,
      x,
      y,
      w,
      h,
      shape: shape as 'rect' | 'circle',
      through: drill > 0,
    })),
    body: {
      w: Math.round(w * 1000) / 1000,
      h: Math.round(h * 1000) / 1000,
      ...(dot ? { pin1: { x: dot.x!, y: dot.y! } } : {}),
    },
  };
}
for (const entry of prototypeEntries.filter((entry) => keys[entry.key])) {
  test(`new ${entry.key} geometry matches prototype for supported choices`, () => {
    const variants = entry.params.reduce<FootprintParams[]>(
      (combinations, param) => {
        const choices =
          param.o ??
          (param.k === 'pins'
            ? Array.from(
                { length: param.n![1]! - param.n![0]! + 1 },
                (_, index) => param.n![0]! + index,
              )
            : [param.n![0]!, param.d, param.n![1]!]);
        return combinations.flatMap((params) =>
          choices.map((value) => ({ ...params, [param.k]: value })),
        );
      },
      [{}],
    );
    for (const params of variants) {
      const actual = footprintGeometry(keys[entry.key]!, paramsFor(entry.key, params));
      expect(actual, `${entry.key}: ${JSON.stringify(params)}`).toStrictEqual(
        expectedGeometry(entry.gen(params)),
      );
    }
  });
}

test('qfp44_pin12_on_bottom_side', () => {
  const geometry = footprintGeometry('qfp', {});
  expect(geometry?.pads).toHaveLength(44);
  expect(geometry?.pads[11]).toMatchObject({ id: '12', x: -4, y: 5.75, w: 0.44, h: 1.5 });
  expect(geometry?.body).toEqual({ w: 10, h: 10, pin1: { x: -4.2, y: -4.2 } });
});
test('point_components_have_one_pin_and_no_body', () => {
  for (const type of ['tp', 'via', 'pad', 'wire', 'hole']) {
    const geometry = footprintGeometry('point', { type });
    expect(geometry?.body).toEqual({ w: 0, h: 0 });
    expect(geometry?.pads).toHaveLength(1);
    expect(geometry?.pads[0]).toMatchObject({ id: '1', x: 0, y: 0 });
  }
});
test('qfn_exposed_pad_adds_ep_pin', () => {
  const plain = footprintGeometry('qfn', { ep: 'ei' });
  const exposed = footprintGeometry('qfn', { ep: 'jah' });
  expect(plain?.pads).toHaveLength(32);
  expect(exposed?.pads).toHaveLength(33);
  expect(exposed?.pads.slice(0, 32)).toEqual(plain?.pads);
  expect(exposed?.pads[32]).toMatchObject({
    id: '33',
    x: 0,
    y: 0,
    w: 2.75,
    h: 2.75,
    shape: 'rect',
    through: false,
  });
});
