import { z } from 'zod';
import { IdSchema, LayerSchema, PinRefSchema, Vec2Schema } from './primitives';

export const DamageAreaSchema = z.strictObject({
  id: IdSchema,
  shape: z.enum(['rect', 'ellipse']),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  text: z.string(),
});
export const DimEndSchema = z.union([
  z.strictObject({ pin: PinRefSchema }),
  z.strictObject({ point: Vec2Schema }),
]);
export const DimensionSchema = z.strictObject({
  id: IdSchema,
  a: DimEndSchema,
  b: DimEndSchema,
  offsetPx: z.number(),
});
export const BoardOutlineSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  showDims: z.boolean(),
});
export const TextNoteSchema = z.strictObject({
  id: IdSchema,
  view: z.enum(['board', 'schematic']),
  at: Vec2Schema,
  text: z.string(),
  anchor: z
    .union([
      z.strictObject({ component: IdSchema }),
      z.strictObject({ connection: IdSchema }),
      z.strictObject({ junction: IdSchema }),
    ])
    .optional(),
});
export const ImportCheckSchema = z.strictObject({
  id: IdSchema,
  at: Vec2Schema,
  layer: LayerSchema,
  junctions: z.array(IdSchema),
  note: z.string(),
});

export type DamageArea = z.infer<typeof DamageAreaSchema>;
export type DimEnd = z.infer<typeof DimEndSchema>;
export type Dimension = z.infer<typeof DimensionSchema>;
export type BoardOutline = z.infer<typeof BoardOutlineSchema>;
export type TextNote = z.infer<typeof TextNoteSchema>;
export type ImportCheck = z.infer<typeof ImportCheckSchema>;
