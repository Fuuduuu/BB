import { defineFootprint } from './types';
import type { PadGeom } from './types';

export const to220Footprint = defineFootprint('to220', 'TO-220', {}, () => ({
  pads: [-2.54, 0, 2.54].map<PadGeom>((x, index) => ({
    id: String(index + 1),
    x,
    y: 1.1,
    w: 1.9,
    h: 2.6,
    shape: 'rect',
    through: true,
  })),
  body: { w: 10.2, h: 4.6 },
}));
