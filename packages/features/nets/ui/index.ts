import type { UiModule } from '@pcbk/ui';
import { netsEt } from './i18n/et';

export function createNetsUi(): UiModule {
  return { id: 'nets', title: netsEt.title };
}
