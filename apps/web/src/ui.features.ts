import type { IdGen } from '@pcbk/contracts';
import { createProjectUi } from '@pcbk/features/project/ui';
import { createComponentsUi } from '@pcbk/features/components/ui';
export const uiFeatures = (ids: IdGen, onHome: () => void) => [
  createProjectUi({ onHome }),
  createComponentsUi(ids),
];
