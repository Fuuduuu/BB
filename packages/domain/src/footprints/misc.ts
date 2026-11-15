import { body, pad } from './helpers';
import { defineFootprint } from './types';

export const xtalFootprint = defineFootprint('xtal', 'Kvarts HC-49', {}, () => ({
  pads: [pad(1, -2.44, 0, 1.5, 1.5, 'circle', 0.8), pad(2, 2.44, 0, 1.5, 1.5, 'circle', 0.8)],
  body: body(11, 4.65),
}));
export const xtalSmdFootprint = defineFootprint('xtal_smd', 'Kvarts SMD', {}, () => ({
  pads: [
    pad(1, -1.1, 0.85, 1.4, 1.15),
    pad(2, 1.1, 0.85, 1.4, 1.15),
    pad(3, 1.1, -0.85, 1.4, 1.15),
    pad(4, -1.1, -0.85, 1.4, 1.15),
  ],
  body: body(3.2, 2.5, { x: -1.9, y: 1.5 }),
}));
export const buttonFootprint = defineFootprint('button', 'Nupp 6×6', {}, () => ({
  pads: [
    pad(1, -3.25, -2.25, 2, 2, 'circle', 1),
    pad(2, 3.25, -2.25, 2, 2, 'circle', 1),
    pad(3, -3.25, 2.25, 2, 2, 'circle', 1),
    pad(4, 3.25, 2.25, 2, 2, 'circle', 1),
  ],
  body: body(6, 6),
}));
export const trimmerFootprint = defineFootprint('trimmer', 'Trimmer', {}, () => ({
  pads: [
    pad(1, -2.54, 2.3, 1.6, 1.6, 'rect', 0.8),
    pad(2, 0, 2.3, 1.6, 1.6, 'circle', 0.8),
    pad(3, 2.54, 2.3, 1.6, 1.6, 'circle', 0.8),
  ],
  body: body(6.6, 7),
}));
