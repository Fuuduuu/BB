import type { IdGen } from '@pcbk/contracts';
import type { KeySpec } from '@pcbk/ui';
import { selectComponent } from '../contract';
import type { DuplicateParams } from '../contract';

export function createDuplicateAction(ids: IdGen): KeySpec['run'] {
  return (api, selection) => {
    const snapshot = api.snapshot();
    const sources = new Set<string>();
    const items: DuplicateParams['items'] = [];
    for (const item of selection.items) {
      if (item.kind !== 'component' || sources.has(item.id)) continue;
      const source = selectComponent(snapshot, item.id);
      if (!source) continue;
      sources.add(source.id);
      items.push({
        sourceId: source.id,
        id: ids.newId('cmp'),
        pinUids: Object.fromEntries(source.pins.map(({ id }) => [id, ids.newId('pin')])),
      });
    }
    if (items.length === 0) return false;
    const result = api.execute('components.duplicate', { items });
    if (result.ok) api.select({ items: items.map(({ id }) => ({ kind: 'component', id })) });
    return result.ok;
  };
}
