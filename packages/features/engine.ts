import type { DocKey } from '@pcbk/domain';
import { componentsEngine } from './components/engine';
import { measurementsEngine } from './measurements/engine';
import { projectEngine } from './project/engine';
import { photoEngine } from './photo/engine';

export const engineFeatures = [projectEngine, componentsEngine, measurementsEngine, photoEngine];

// Veel ehitamata moodulite väljad.
export const RESERVED_FIELDS: DocKey[] = [
  'junctions',
  'connections',
  'netLabels',
  'roles',
  'measureSettings',
  'repairs',
  'areas',
  'dimensions',
  'outline',
  'textNotes',
  'guide',
];
