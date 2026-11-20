import type { DocKey } from '@pcbk/domain';
import { componentsEngine } from './components/engine';
import { connectionsEngine } from './connections/engine';
import { measurementsEngine } from './measurements/engine';
import { netsEngine } from './nets/engine';
import { projectEngine } from './project/engine';
import { photoEngine } from './photo/engine';

export const engineFeatures = [
  projectEngine,
  componentsEngine,
  measurementsEngine,
  photoEngine,
  connectionsEngine,
  netsEngine,
];

// Veel ehitamata moodulite väljad.
export const RESERVED_FIELDS: DocKey[] = [
  'measureSettings',
  'repairs',
  'areas',
  'dimensions',
  'outline',
  'textNotes',
  'guide',
];
