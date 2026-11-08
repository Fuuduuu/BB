import { z } from 'zod';
import type { CommandSpec, EngineModule } from './types';

const remove: CommandSpec<{ ids: string[] }> = {
  id: 'items.delete',
  title: 'items.delete',
  params: z.strictObject({ ids: z.array(z.string()) }),
  alsoWrites: ['components'],
  run(doc, params) {
    const selected = new Set(params.ids);
    const remaining = doc.components.filter((item) => !selected.has(item.id));
    if (remaining.length !== doc.components.length) doc.components = remaining;
  },
};
export const coreItems: EngineModule = { id: 'core', commands: [remove] };
