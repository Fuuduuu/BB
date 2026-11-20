import { createElement } from 'react';
import type { UiModule } from '@pcbk/ui';
import { netsEt } from './i18n/et';
import { NetsNotices } from './NetsNotices';

export function createNetsUi(): UiModule {
  return {
    id: 'nets',
    title: netsEt.title,
    bottomBar: [{ id: 'nets.notices', render: () => createElement(NetsNotices) }],
  };
}
