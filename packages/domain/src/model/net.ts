import { z } from 'zod';
import { EndRefSchema, IdSchema } from './primitives';

export const NetRoleSchema = z.strictObject({
  id: IdSchema,
  label: z.string(),
  kind: z.enum(['ground', 'power', 'signal', 'unknown']),
  nominalV: z.number().optional(),
  color: z.string().regex(/^#[\da-f]{6}$/i),
});

export const NetLabelSchema = z.strictObject({
  id: IdSchema,
  anchor: EndRefSchema,
  name: z.string().optional(),
  roleId: IdSchema.optional(),
  source: z.enum(['user', 'import']),
});

export type NetRole = z.infer<typeof NetRoleSchema>;
export type NetLabel = z.infer<typeof NetLabelSchema>;
