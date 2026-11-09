import { defineFootprint, readNumber, roundMm, type PadGeom } from './types';

export const header1Footprint = defineFootprint(
  'header1',
  '1×N',
  { pins: 4, pitch: 2.54 },
  (params) => {
    const pins = readNumber(params.pins);
    const pitch = readNumber(params.pitch);
    if (
      pins === undefined ||
      !Number.isInteger(pins) ||
      pins < 1 ||
      pins > 40 ||
      (pitch !== 1.27 && pitch !== 2 && pitch !== 2.54)
    ) {
      return undefined;
    }

    const center = (pins - 1) / 2;
    const padSize = roundMm(pitch * 0.68);
    const pads = Array.from({ length: pins }, (_, index): PadGeom => ({
      id: String(index + 1),
      x: roundMm((index - center) * pitch),
      y: 0,
      w: padSize,
      h: padSize,
      shape: index === 0 ? 'rect' : 'circle',
      through: true,
    }));
    return { pads, body: { w: roundMm(pins * pitch), h: pitch } };
  },
);
