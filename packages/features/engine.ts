import type { DocKey } from '@pcbk/domain';
import { componentsEngine } from './components/engine';
import { measurementsEngine } from './measurements/engine';
import { projectEngine } from './project/engine';

export const engineFeatures = [projectEngine, componentsEngine, measurementsEngine];

// Veel ehitamata moodulite väljad.
export const RESERVED_FIELDS: DocKey[] = [
  'photos',
  'activePhotoId',
  'scale',
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
