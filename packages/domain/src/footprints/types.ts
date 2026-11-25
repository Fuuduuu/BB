import type { Vec2 } from '../model/primitives';

export interface PadGeom {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'rect' | 'circle' | 'oval';
  through: boolean;
  name?: string;
}

export interface FootprintGeom {
  pads: PadGeom[];
  body: { w: number; h: number; pin1?: Vec2 };
}

export interface FootprintParams {
  [key: string]: string | number;
}

export type BodyShape = 'rect' | 'circle' | 'oval' | 'd';
export type BodyFlat = '-x' | '+x' | '-y' | '+y';
export interface BodyShapeSpec {
  shape: BodyShape;
  flat?: BodyFlat;
}

export interface FootprintDef {
  key: string;
  name: string;
  defaults: FootprintParams;
  bodyShape?: BodyShapeSpec;
  gen(p: FootprintParams): FootprintGeom | undefined;
}

export function isParameterObject(params: FootprintParams): boolean {
  return typeof params === 'object' && params !== null && !Array.isArray(params);
}

export function defineFootprint(
  key: string,
  name: string,
  defaults: FootprintParams,
  generate: FootprintDef['gen'],
  bodyShape?: BodyShapeSpec,
): FootprintDef {
  const expectedKeys = Object.keys(defaults);
  return {
    key,
    name,
    defaults,
    ...(bodyShape && { bodyShape }),
    gen(params) {
      if (!isParameterObject(params)) return undefined;
      const keys = Object.keys(params);
      if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
        return undefined;
      }
      return generate(params);
    },
  };
}

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function readNumber(value: string | number | undefined): number | undefined {
  if (typeof value === 'string') {
    const decimal = value.trim();
    if (!DECIMAL.test(decimal)) return undefined;
    value = Number(decimal);
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function roundMm(value: number): number {
  return Math.round(value * 1000) / 1000;
}
