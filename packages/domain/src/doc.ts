import { CURRENT_FORMAT_VERSION, DEFAULT_ROLES } from './constants';
import type { BoardDoc } from './model/board';

export function newBoardDoc(name: string): BoardDoc {
  return {
    format_version: CURRENT_FORMAT_VERSION,
    rev: 0,
    name,
    status: 'mapping',
    scale: { pxPerMm: 10, calibrated: false },
    photos: [],
    components: [],
    junctions: [],
    connections: [],
    netLabels: [],
    roles: DEFAULT_ROLES.map((role) => ({ ...role })),
    measurements: [],
    measureSettings: { voltageTolerancePct: 10, voltageToleranceMinV: 0.1 },
    repairs: [],
    areas: [],
    dimensions: [],
    textNotes: [],
    importChecks: [],
    guide: { skipped: [] },
  };
}
