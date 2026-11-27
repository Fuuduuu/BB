import { IdSchema, SymbolPlacementSchema } from '@pcbk/domain';
import { z } from 'zod';

export const SchematicPlaceSchema = z.strictObject({
  items: z.array(
    SymbolPlacementSchema.pick({ at: true, rot: true, mirror: true }).extend({ id: IdSchema }),
  ),
});
export const SchematicRemoveSchema = z.strictObject({ ids: z.array(IdSchema) });

export type SchematicPlaceParams = z.infer<typeof SchematicPlaceSchema>;
export type SchematicRemoveParams = z.infer<typeof SchematicRemoveSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'schematic.place': SchematicPlaceParams;
    'schematic.remove': SchematicRemoveParams;
  }
}
