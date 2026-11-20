import type { IdGen, Snapshot } from '@pcbk/contracts';
import { createComponentsUi } from './components/ui';
import { connectionPoints, createConnectionsUi } from './connections/ui';
import { createMeasurementsUi } from './measurements/ui';
import { netRoleColor } from './nets/contract';
import { createNetsUi } from './nets/ui';
import { createProjectUi } from './project/ui';
import { createPhotoUi } from './photo/ui';

const netNames = new WeakMap<
  NonNullable<Snapshot['derived']['nets']>['list'],
  Map<string, string>
>();

function netName({ derived: { nets } }: Snapshot, memberKey: string): string | undefined {
  const key = nets?.netOf[memberKey];
  if (!nets || typeof key !== 'string') return;
  let names = netNames.get(nets.list);
  if (!names) {
    names = new Map(nets.list.filter(({ named }) => named).map(({ key, name }) => [key, name]));
    netNames.set(nets.list, names);
  }
  return names.get(key);
}

export const uiFeatures = (ids: IdGen, onHome: () => void) => [
  createProjectUi({ onHome }),
  createPhotoUi(),
  createComponentsUi(ids),
  createConnectionsUi(ids, { roleColor: netRoleColor, netName }),
  createNetsUi(ids, connectionPoints),
  createMeasurementsUi(ids),
];
