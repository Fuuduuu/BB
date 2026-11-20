import { createElement } from 'react';
import type { IdGen } from '@pcbk/contracts';
import type { UiModule } from '@pcbk/ui';
import { netsEt } from './i18n/et';
import type { ConnectionPoints } from './net-details';
import { NetsNotices } from './NetsNotices';
import { NetsTab } from './NetsTab';
import { pinRolesLayer } from './pin-roles-layer';

export function createNetsUi(ids: IdGen, connectionPoints: ConnectionPoints): UiModule {
  return {
    id: 'nets',
    title: netsEt.title,
    bottomBar: [{ id: 'nets.notices', render: () => createElement(NetsNotices) }],
    navigatorTabs: [
      {
        id: 'nets',
        title: netsEt.title,
        order: 2,
        summary: (snapshot) => netsEt.summary(snapshot.derived.nets?.list.length ?? 0),
        render: () => createElement(NetsTab, { ids, connectionPoints }),
      },
    ],
    canvasLayers: [pinRolesLayer],
  };
}
