import { z } from 'zod';
import { EndRefSchema, IdSchema, TimestampSchema } from './primitives';

export const RepairActionSchema = z.strictObject({
  id: IdSchema,
  action: z.enum(['replaced', 'removed', 'reflowed', 'trace_fixed', 'cleaned', 'other']),
  text: z.string(),
  at: TimestampSchema,
  affects: z.union([
    z.strictObject({ component: IdSchema }),
    z.strictObject({ nets: z.array(EndRefSchema) }),
    z.strictObject({ wholeBoard: z.literal(true) }),
    z.strictObject({ nothing: z.literal(true) }),
  ]),
});

export type RepairAction = z.infer<typeof RepairActionSchema>;
