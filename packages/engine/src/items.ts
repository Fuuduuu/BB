import type { ParamsOf } from '@pcbk/contracts';
import { z } from 'zod';
import { CommandTargetNotFound, reject } from './errors';
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

const translate: CommandSpec<ParamsOf<'items.translate'>> = {
  id: 'items.translate',
  title: 'items.translate',
  params: z.strictObject({
    items: z.array(z.strictObject({ kind: z.literal('component'), id: z.string() })),
    dx: z.number(),
    dy: z.number(),
  }),
  alsoWrites: ['components'],
  run(doc, { items, dx, dy }) {
    const selected = new Set(items.map((item) => item.id));
    const components = new Map(doc.components.map((component) => [component.id, component]));
    for (const id of selected) {
      const component = components.get(id);
      if (!component) throw new CommandTargetNotFound(id);
      const { board } = component;
      if (!board) reject('component_not_placed');
      if (dx !== 0) board.center.x += dx;
      if (dy !== 0) board.center.y += dy;
    }
  },
};

export const coreItems: EngineModule = { id: 'core', commands: [remove, translate] };
