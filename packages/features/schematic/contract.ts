import { IdSchema, SymbolPlacementSchema } from '@pcbk/domain';
import { stringRecord } from '@pcbk/domain/model';
import { z } from 'zod';

export const SchematicPlaceSchema = z.strictObject({
  items: z.array(
    SymbolPlacementSchema.pick({ at: true, rot: true, mirror: true }).extend({ id: IdSchema }),
  ),
});
export const SchematicRemoveSchema = z.strictObject({ ids: z.array(IdSchema) });

const pinMapSchema = stringRecord(z.string(), z.string()).nullable();
export const SchematicSetSymbolSchema = z.strictObject({
  id: IdSchema,
  pinMap: z.unknown().transform((value, context) => {
    const parsed = pinMapSchema.safeParse(value);
    if (parsed.success) return parsed.data;
    context.addIssue({ code: 'custom', message: 'invalid_pin_map' });
    return z.NEVER;
  }),
});

export type SchematicPlaceParams = z.infer<typeof SchematicPlaceSchema>;
export type SchematicRemoveParams = z.infer<typeof SchematicRemoveSchema>;
export type SchematicSetSymbolParams = z.infer<typeof SchematicSetSymbolSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'schematic.place': SchematicPlaceParams;
    'schematic.remove': SchematicRemoveParams;
    'schematic.setSymbol': SchematicSetSymbolParams;
  }
}
