import type { ParamsOf } from '@pcbk/contracts';
import { deleteItems, ITEM_FIELDS, ItemRefSchema, translateItems } from '@pcbk/domain/rules';
import { z } from 'zod';
import type { CommandSpec, EngineModule } from './types';

const remove: CommandSpec<{ ids: string[] }> = {
  id: 'items.delete',
  title: 'items.delete',
  params: z.strictObject({ ids: z.array(z.string()) }),
  alsoWrites: [...ITEM_FIELDS],
  run(doc, { ids }) {
    deleteItems(doc, ids);
  },
};

const translate: CommandSpec<ParamsOf<'items.translate'>> = {
  id: 'items.translate',
  title: 'items.translate',
  params: z.strictObject({
    items: z.array(ItemRefSchema),
    dx: z.number(),
    dy: z.number(),
  }),
  alsoWrites: [...ITEM_FIELDS],
  run(doc, { items, dx, dy }) {
    translateItems(doc, items, { x: dx, y: dy });
  },
};

export const coreItems: EngineModule = { id: 'core', commands: [remove, translate] };
