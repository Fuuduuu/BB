import type { ParamsOf } from '@pcbk/contracts';
import {
  deleteItems,
  isEmptyReport,
  ITEM_FIELDS,
  ItemRefSchema,
  translateItems,
} from '@pcbk/domain/rules';
import { z } from 'zod';
import type { CommandSpec, EngineModule } from './types';

const remove: CommandSpec<{ ids: string[] }> = {
  id: 'items.delete',
  title: 'items.delete',
  params: z.strictObject({ ids: z.array(z.string()) }),
  alsoWrites: [...ITEM_FIELDS],
  run(doc, { ids }, ctx) {
    const report = deleteItems(doc, ids);
    if (!isEmptyReport(report)) ctx.emit({ type: 'rules.report', payload: report });
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
