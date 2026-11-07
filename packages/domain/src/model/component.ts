import { z } from 'zod';
import { IdSchema, SideSchema, Vec2Schema } from './primitives';
import { stringRecord } from './record';

export const ComponentKindSchema = z.enum([
  'resistor',
  'capacitor',
  'capacitor_polarized',
  'inductor',
  'diode',
  'led',
  'zener',
  'npn',
  'pnp',
  'nmos',
  'pmos',
  'regulator',
  'ic',
  'connector',
  'crystal',
  'switch',
  'fuse',
  'testpoint',
  'via',
  'pad',
  'wire_point',
  'hole',
  'other',
]);

export const PinSchema = z.strictObject({
  id: IdSchema,
  uid: IdSchema,
  name: z.string().optional(),
  nc: z.boolean(),
});

export const BoardPlacementSchema = z.strictObject({
  footprint: z.string().min(1),
  params: stringRecord(z.string(), z.union([z.string(), z.number()])),
  center: Vec2Schema,
  rotationDeg: z.number(),
  side: SideSchema,
  scaleX: z.number().min(0.2).max(5),
  scaleY: z.number().min(0.2).max(5),
  padMap: stringRecord(IdSchema, IdSchema).optional(),
  customPads: stringRecord(
    IdSchema,
    z.strictObject({
      local: Vec2Schema,
      sizeMm: z.number().positive(),
      shape: z.enum(['circle', 'rect']),
      through: z.boolean(),
    }),
  ),
  labelOffset: Vec2Schema.optional(),
});

export const SymbolPlacementSchema = z.strictObject({
  symbol: z.string().min(1),
  at: Vec2Schema,
  rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  mirror: z.boolean(),
  pinMap: stringRecord(IdSchema, IdSchema).optional(),
  labelOffset: Vec2Schema.optional(),
});

export const ComponentSchema = z.strictObject({
  id: IdSchema,
  ref: z.string().min(1),
  kind: ComponentKindSchema,
  marking: z.string(),
  value: z.string(),
  identified: z.boolean(),
  dnp: z.boolean(),
  note: z.string(),
  referenceImageId: IdSchema.optional(),
  pins: z.array(PinSchema),
  board: BoardPlacementSchema.optional(),
  schematic: SymbolPlacementSchema.optional(),
});

export type ComponentKind = z.infer<typeof ComponentKindSchema>;
export type Pin = z.infer<typeof PinSchema>;
export type BoardPlacement = z.infer<typeof BoardPlacementSchema>;
export type SymbolPlacement = z.infer<typeof SymbolPlacementSchema>;
export type Component = z.infer<typeof ComponentSchema>;
