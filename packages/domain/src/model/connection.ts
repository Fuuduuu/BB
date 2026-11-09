import { z } from 'zod';
import { EndRefSchema, IdSchema, LayerSchema, Vec2Schema } from './primitives';

export const JunctionSchema = z.strictObject({
  id: IdSchema,
  board: z.strictObject({ at: Vec2Schema, layer: LayerSchema }).optional(),
  schematic: z.strictObject({ at: Vec2Schema }).optional(),
});

export const ConnectionSchema = z.strictObject({
  id: IdSchema,
  a: EndRefSchema,
  b: EndRefSchema,
  basis: z.enum(['assumed', 'visual']),
  board: z
    .strictObject({
      kind: z.enum(['trace', 'wire']),
      layer: LayerSchema,
      waypoints: z.array(Vec2Schema),
      widthMm: z.number().positive(),
      labelOffset: Vec2Schema.optional(),
    })
    .optional(),
  schematic: z.strictObject({ waypoints: z.array(Vec2Schema) }).optional(),
});

export type Junction = z.infer<typeof JunctionSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
