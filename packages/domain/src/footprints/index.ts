import { areaFootprint } from './area';
import { chipFootprint } from './chip';
import {
  dcJackFootprint,
  header2Footprint,
  jstFootprint,
  microUsbFootprint,
  terminalFootprint,
  usbCFootprint,
} from './connectors';
import { header1Footprint } from './header';
import { dipFootprint, qfnFootprint, qfpFootprint, sopFootprint } from './integrated';
import { buttonFootprint, trimmerFootprint, xtalFootprint, xtalSmdFootprint } from './misc';
import {
  axialFootprint,
  chipDiodeFootprint,
  chipTantFootprint,
  discFootprint,
  elSmdFootprint,
  ledThtFootprint,
  radialFootprint,
} from './passives';
import { pointFootprint } from './points';
import { dpakFootprint, sot223Footprint, to92Footprint } from './semiconductors';
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
  chipTantFootprint,
  chipDiodeFootprint,
  elSmdFootprint,
  axialFootprint,
  discFootprint,
  radialFootprint,
  ledThtFootprint,
  sot223Footprint,
  dpakFootprint,
  to92Footprint,
  sopFootprint,
  dipFootprint,
  qfpFootprint,
  qfnFootprint,
  header2Footprint,
  jstFootprint,
  terminalFootprint,
  usbCFootprint,
  microUsbFootprint,
  dcJackFootprint,
  xtalFootprint,
  xtalSmdFootprint,
  buttonFootprint,
  trimmerFootprint,
  pointFootprint,
];

export function footprintGeometry(key: string, params: FootprintParams): FootprintGeom | undefined {
  const definition = FOOTPRINTS.find((entry) => entry.key === key);
  if (!definition || !isParameterObject(params)) return undefined;
  return definition.gen({ ...definition.defaults, ...params });
}

export function footprintPinIds(key: string, params: FootprintParams): string[] | undefined {
  return footprintGeometry(key, params)?.pads.map((pad) => pad.id);
}
