import { chipGeometry } from './chip';
import { defineFootprint, withBodyMarks } from './types';

export const chipLedFootprint = withBodyMarks(
  defineFootprint('chip_led', 'LED SMD', { size: '0805' }, (params) => {
    const geometry = chipGeometry(params);
    if (!geometry || !['0603', '0805', '1206'].includes(String(params.size))) return undefined;
    return {
      ...geometry,
      pads: geometry.pads.map((pad, index) => ({ ...pad, name: index === 0 ? 'K' : 'A' })),
    };
  }),
  [{ kind: 'band', pin: 'K' }],
);
