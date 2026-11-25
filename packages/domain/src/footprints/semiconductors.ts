import { body, pad } from './helpers';
import { defineFootprint } from './types';

export const sot223Footprint = defineFootprint('sot223', 'SOT-223', {}, () => ({
  pads: [
    pad(1, -2.3, 3.15, 0.95, 2),
    pad(2, 0, 3.15, 0.95, 2),
    pad(3, 2.3, 3.15, 0.95, 2),
    pad(4, 0, -3.15, 3.25, 2),
  ],
  body: body(6.5, 3.5, { x: -2.6, y: 1.1 }),
}));
export const dpakFootprint = defineFootprint('dpak', 'DPAK', {}, () => ({
  pads: [pad(1, -2.28, 4.1, 1.1, 1.8), pad(2, 0, -1.6, 5.8, 6.2), pad(3, 2.28, 4.1, 1.1, 1.8)],
  body: body(6.6, 6.1),
}));
export const to92Footprint = defineFootprint(
  'to92',
  'TO-92',
  {},
  () => ({
    pads: [
      pad(1, -1.27, 0, 1.05, 1.5, 'rect', 0.6),
      pad(2, 0, 0, 1.05, 1.5, 'oval', 0.6),
      pad(3, 1.27, 0, 1.05, 1.5, 'oval', 0.6),
    ],
    body: body(4.8, 4),
  }),
  { shape: 'd', flat: '+y' },
);
