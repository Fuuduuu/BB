import { areaFootprint } from './area';
import { chipFootprint } from './chip';
import { header1Footprint } from './header';
import { soicFootprint } from './soic';
import { sot23Footprint } from './sot23';
import { to220Footprint } from './to220';
import { isParameterObject } from './types';
import type { FootprintDef, FootprintGeom, FootprintParams } from './types';

export type { FootprintDef, FootprintGeom, FootprintParams, PadGeom } from './types';

export const FOOTPRINTS: readonly FootprintDef[] = [
  chipFootprint,
  sot23Footprint,
  soicFootprint,
  to220Footprint,
  header1Footprint,
  areaFootprint,
];

export function footprintGeometry(key: string, params: FootprintParams): FootprintGeom | undefined {
  const definition = FOOTPRINTS.find((entry) => entry.key === key);
  if (!definition || !isParameterObject(params)) return undefined;
  return definition.gen({ ...definition.defaults, ...params });
}

export function footprintPinIds(key: string, params: FootprintParams): string[] | undefined {
  return footprintGeometry(key, params)?.pads.map((pad) => pad.id);
}
