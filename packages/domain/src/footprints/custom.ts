import { body, numberRange, pad } from './helpers';
import { defineFootprint, type PadGeom } from './types';

export const customFootprint = defineFootprint(
  'custom',
  'Custom',
  { layout: 'two_rows', pins: 8, pitch: 2.54, w: 8, h: 10 },
  (params) => {
    const pins = numberRange(params.pins, 0, 200, true);
    const pitch = numberRange(params.pitch, 0.3, 10);
    const w = numberRange(params.w, 1, 200);
    const h = numberRange(params.h, 1, 200);
    if (pins === undefined || pitch === undefined || w === undefined || h === undefined)
      return undefined;

    const pads: PadGeom[] = [];
    const size = Math.min(pitch * 0.6, 1.6);
    const appendPad = (x: number, y: number) => {
      pads.push(pad(pads.length + 1, x, y, size, size, pads.length === 0 ? 'rect' : 'circle'));
    };

    switch (params.layout) {
      case 'one_row':
        for (let i = 0; i < pins; i++) appendPad((i - (pins - 1) / 2) * pitch, 0);
        break;
      case 'two_rows': {
        const leftCount = Math.ceil(pins / 2);
        const y0 = (-(leftCount - 1) / 2) * pitch;
        for (let i = 0; i < leftCount; i++) appendPad(-w / 2, y0 + i * pitch);
        for (let i = 0; i < pins - leftCount; i++)
          appendPad(w / 2, y0 + (leftCount - 1 - i) * pitch);
        break;
      }
      case 'four_sides': {
        const padsPerSide = Math.max(1, Math.ceil(pins / 4));
        const positions: ((offset: number) => [number, number])[] = [
          (offset) => [-w / 2, offset],
          (offset) => [offset, h / 2],
          (offset) => [w / 2, -offset],
          (offset) => [-offset, -h / 2],
        ];
        for (let i = 0; i < pins; i++) {
          const offset = ((i % padsPerSide) - (padsPerSide - 1) / 2) * pitch;
          appendPad(...positions[Math.floor(i / padsPerSide)]!(offset));
        }
        break;
      }
      case 'empty':
        break;
      default:
        return undefined;
    }

    return { pads, body: body(w, h, pins > 0 ? { x: -w / 2 + 0.9, y: -h / 2 + 0.9 } : undefined) };
  },
);
