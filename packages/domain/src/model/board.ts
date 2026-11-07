import { z } from 'zod';
import { CURRENT_FORMAT_VERSION } from '../constants';
import {
  BoardOutlineSchema,
  DamageAreaSchema,
  DimensionSchema,
  ImportCheckSchema,
  TextNoteSchema,
} from './annotation';
import { ComponentSchema } from './component';
import { ConnectionSchema, JunctionSchema } from './connection';
import { MeasurementSchema } from './measurement';
import { NetLabelSchema, NetRoleSchema } from './net';
import { PhotoRefSchema } from './photo';
import { CountSchema, IdSchema, TimestampSchema, Vec2Schema } from './primitives';
import { ProgressSnapshotSchema } from './progress';
import { RepairActionSchema } from './repair';

export const BoardDocSchema = z.strictObject({
  format_version: z.literal(CURRENT_FORMAT_VERSION),
  rev: CountSchema,
  name: z.string(),
  device: z.string().optional(),
  problem: z.string().optional(),
  status: z.enum(['mapping', 'mapped']),
  mappedAt: TimestampSchema.optional(),
  mappedSnapshot: ProgressSnapshotSchema.optional(),
  scale: z.strictObject({
    pxPerMm: z.number().positive(),
    calibrated: z.boolean(),
    calib: z.strictObject({ a: Vec2Schema, b: Vec2Schema, mm: z.number().positive() }).optional(),
  }),
  photos: z.array(PhotoRefSchema),
  activePhotoId: IdSchema.optional(),
  components: z.array(ComponentSchema),
  junctions: z.array(JunctionSchema),
  connections: z.array(ConnectionSchema),
  netLabels: z.array(NetLabelSchema),
  roles: z.array(NetRoleSchema),
  measurements: z.array(MeasurementSchema),
  measureSettings: z.strictObject({
    voltageTolerancePct: z.number().nonnegative(),
    voltageToleranceMinV: z.number().nonnegative(),
  }),
  repairs: z.array(RepairActionSchema),
  areas: z.array(DamageAreaSchema),
  dimensions: z.array(DimensionSchema),
  outline: BoardOutlineSchema.optional(),
  textNotes: z.array(TextNoteSchema),
  importChecks: z.array(ImportCheckSchema),
  guide: z.strictObject({ skipped: z.array(z.string()) }),
});

export type BoardDoc = z.infer<typeof BoardDocSchema>;
export type DocKey = keyof BoardDoc;
