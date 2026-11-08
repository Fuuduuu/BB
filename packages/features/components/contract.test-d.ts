import { newId } from '@pcbk/domain';
import type { DocumentEngine, IdGen, Snapshot } from '@pcbk/contracts';
import { makeAddComponent, selectComponent, selectComponents } from './contract';
import type { AddComponentParams } from './contract';
import '../project/contract';

declare const engine: DocumentEngine;
declare const snapshot: Snapshot;
const ids: IdGen = { newId };
const params: AddComponentParams = makeAddComponent(ids, 'ic', 8);
engine.execute('components.add', params);
engine.execute('components.update', { id: 'cmp_a', value: '10k' });
engine.execute('components.renamePin', { id: 'cmp_a', pinId: '1', name: null });
engine.execute('project.rename', { name: 'Plaat' });
engine.execute('project.setInfo', { device: 'PSU-1' });
// @ts-expect-error the caller supplies pin instance identities
engine.execute('components.add', { id: 'cmp_a', kind: 'ic', pins: [{ id: '1' }] });
// @ts-expect-error the command cannot replace the whole pin list
engine.execute('components.update', { id: 'cmp_a', pins: [] });
// @ts-expect-error NC is a boolean
engine.execute('components.setNc', { id: 'cmp_a', pinId: '1', nc: 'yes' });
// @ts-expect-error project names are strings
engine.execute('project.rename', { name: 1 });
// @ts-expect-error selectors expose a readonly collection
selectComponents(snapshot).push({});
// @ts-expect-error selectors expose readonly component properties
selectComponent(snapshot, 'cmp_a')!.value = '10k';
// @ts-expect-error nested pin data remains readonly
selectComponent(snapshot, 'cmp_a')!.pins[0]!.uid = 'pin_changed';
