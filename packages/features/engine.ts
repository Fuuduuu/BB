import type { DocKey } from '@pcbk/domain';
import { componentsEngine } from './components/engine';
import { projectEngine } from './project/engine';

export const engineFeatures = [projectEngine, componentsEngine];

export const RESERVED_FIELDS_M0: DocKey[] = [
  'photos',
  'activePhotoId',
  'scale',
  'junctions',
  'connections',
  'netLabels',
  'roles',
  'measurements',
  'measureSettings',
  'repairs',
  'areas',
  'dimensions',
  'outline',
  'textNotes',
  'guide',
];
