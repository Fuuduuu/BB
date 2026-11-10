import type { IdGen } from '@pcbk/contracts';
import { createComponentsUi } from './components/ui';
import { createMeasurementsUi } from './measurements/ui';
import { createProjectUi } from './project/ui';

export const uiFeatures = (ids: IdGen, onHome: () => void) => [
  createProjectUi({ onHome }),
  createComponentsUi(ids),
  createMeasurementsUi(ids),
];
