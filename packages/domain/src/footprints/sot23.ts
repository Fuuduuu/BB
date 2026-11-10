import { defineFootprint, readNumber, roundMm } from './types';
import type { PadGeom } from './types';

const padCenters = {
  3: [
    [-0.95, 1],
    [0.95, 1],
    [0, -1],
  ],
  5: [
    [-0.95, 1.1],
    [0, 1.1],
    [0.95, 1.1],
    [0.95, -1.1],
    [-0.95, -1.1],
  ],
  6: [
    [-0.95, 1.1],
    [0, 1.1],
    [0.95, 1.1],
    [0.95, -1.1],
    [0, -1.1],
    [-0.95, -1.1],
  ],
} as const;

export const sot23Footprint = defineFootprint('sot23', 'SOT-23', { pins: 3 }, (params) => {
  const pins = readNumber(params.pins);
  if (pins !== 3 && pins !== 5 && pins !== 6) return undefined;

  const height = pins === 3 ? 1.3 : 1.6;
  return {
    pads: padCenters[pins].map<PadGeom>(([x, y], index) => ({
      id: String(index + 1),
      x,
      y,
      w: 0.6,
      h: 0.8,
      shape: 'rect',
      through: false,
    })),
    body: { w: 2.9, h: height, pin1: { x: -1.05, y: roundMm(height / 2 - 0.35) } },
  };
});
