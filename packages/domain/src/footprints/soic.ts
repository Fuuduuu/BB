import { defineFootprint, readNumber, roundMm, type PadGeom } from './types';

export const soicFootprint = defineFootprint('soic', 'SOIC', { pins: 8, body: 3.9 }, (params) => {
  const pins = readNumber(params.pins);
  const width = readNumber(params.body);
  if (
    pins === undefined ||
    ![8, 14, 16, 20, 24, 28].includes(pins) ||
    (width !== 3.9 && width !== 7.5)
  ) {
    return undefined;
  }

  const pitch = 1.27;
  const padWidth = 1.55;
  const pinsPerSide = pins / 2;
  const xOffset = width / 2 + padWidth / 2 + 0.05;
  const firstY = (-(pinsPerSide - 1) * pitch) / 2;
  const height = pinsPerSide * pitch - 0.2;
  const pads = Array.from({ length: pins }, (_, index): PadGeom => {
    const left = index < pinsPerSide;
    const row = left ? index : pins - 1 - index;
    return {
      id: String(index + 1),
      x: roundMm(left ? -xOffset : xOffset),
      y: roundMm(firstY + row * pitch),
      w: padWidth,
      h: 0.6,
      shape: 'rect',
      through: false,
    };
  });

  return {
    pads,
    body: {
      w: width,
      h: roundMm(height),
      pin1: { x: roundMm(-width / 2 + 0.6), y: roundMm(-height / 2 + 0.6) },
    },
  };
});
