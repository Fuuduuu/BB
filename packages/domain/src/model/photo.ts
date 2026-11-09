import { z } from 'zod';
import { IdSchema, SideSchema } from './primitives';

export const PhotoRefSchema = z.strictObject({
  id: IdSchema,
  side: SideSchema,
  name: z.string(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  toBoard: z
    .tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()])
    .optional(),
  transform: z.enum([
    'none',
    'rot90',
    'rot180',
    'rot270',
    'mirror',
    'mirror_rot90',
    'mirror_rot180',
    'mirror_rot270',
  ]),
});

export type PhotoRef = z.infer<typeof PhotoRefSchema>;
