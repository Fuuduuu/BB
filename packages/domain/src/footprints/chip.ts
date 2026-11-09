import { defineFootprint } from './types';
import type { PadGeom } from './types';

type ChipDimensions = [offset: number, padW: number, padH: number, bodyW: number, bodyH: number];

const sizes = new Map<string, ChipDimensions>([
  ['0402', [0.5, 0.6, 0.6, 1, 0.5]],
  ['0603', [0.8, 0.8, 0.95, 1.6, 0.8]],
  ['0805', [1, 1, 1.35, 2, 1.25]],
  ['1206', [1.5, 1.15, 1.8, 3.2, 1.6]],
  ['1210', [1.5, 1.15, 2.7, 3.2, 2.5]],
  ['2010', [2.4, 1.3, 2.6, 5, 2.5]],
  ['2512', [2.95, 1.5, 3.4, 6.3, 3.2]],
]);

export const chipFootprint = defineFootprint('chip', 'Chip', { size: '0805' }, ({ size }) => {
  const dimensions = typeof size === 'string' ? sizes.get(size) : undefined;
  if (!dimensions) return undefined;

  const [offset, padW, padH, bodyW, bodyH] = dimensions;
  return {
    pads: [-offset, offset].map<PadGeom>((x, index) => ({
      id: String(index + 1),
      x,
      y: 0,
      w: padW,
      h: padH,
      shape: 'rect',
      through: false,
    })),
    body: { w: bodyW, h: bodyH },
  };
});
