import type { IdGen } from '@pcbk/contracts';
import { createComponentsUi } from './components/ui';
import { createConnectionsUi } from './connections/ui';
import { createMeasurementsUi } from './measurements/ui';
import { createNetsUi } from './nets/ui';
import { createProjectUi } from './project/ui';
import { createPhotoUi } from './photo/ui';

export const uiFeatures = (ids: IdGen, onHome: () => void) => [
  createProjectUi({ onHome }),
  createPhotoUi(),
  createComponentsUi(ids),
  createConnectionsUi(ids),
  createNetsUi(),
  createMeasurementsUi(ids),
];
