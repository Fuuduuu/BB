import type { IdGen } from '@pcbk/contracts';
import { createComponentsUi } from './components/ui';
import { createMeasurementsUi } from './measurements/ui';
import { createProjectUi } from './project/ui';
import { createPhotoUi } from './photo/ui';

export const uiFeatures = (ids: IdGen, onHome: () => void) => [
  createProjectUi({ onHome }),
  createPhotoUi(),
  createComponentsUi(ids),
  createMeasurementsUi(ids),
];
