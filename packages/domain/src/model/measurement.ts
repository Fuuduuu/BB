import { z } from 'zod';
import { IdSchema, MeasuredPinSchema, TimestampSchema } from './primitives';

export const MeasurementSchema = z.strictObject({
  id: IdSchema,
  mode: z.enum(['voltage', 'resistance', 'diode', 'continuity']),
  at: MeasuredPinSchema,
  ref: MeasuredPinSchema.optional(),
  value: z.number().optional(),
  overload: z.boolean().optional(),
  beep: z.boolean().optional(),
  power: z.enum(['on', 'off', 'unknown']),
  takenAt: TimestampSchema,
  note: z.string().optional(),
  atLabel: z.string(),
  refLabel: z.string().optional(),
  staleByRepairId: IdSchema.optional(),
  source: z.enum(['manual', 'beep_mode']),
});

export type Measurement = z.infer<typeof MeasurementSchema>;
