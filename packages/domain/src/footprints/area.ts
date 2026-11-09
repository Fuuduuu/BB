import { defineFootprint, readNumber } from './types';

export const areaFootprint = defineFootprint('area', 'Area', { w: 8, h: 10 }, (params) => {
  const w = readNumber(params.w);
  const h = readNumber(params.h);
  if (w === undefined || h === undefined || w <= 0 || h <= 0) {
    return undefined;
  }
  return { pads: [], body: { w, h } };
});
