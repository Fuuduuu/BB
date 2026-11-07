import { z } from 'zod';
import { CountSchema } from './primitives';

export const ProgressSnapshotSchema = z.strictObject({
  componentsIdentified: z.tuple([CountSchema, CountSchema]),
  pinsMapped: z.tuple([CountSchema, CountSchema]),
  unplaced: z.strictObject({ board: CountSchema, schematic: CountSchema }),
  powerDefined: z.boolean(),
  assumedConnections: CountSchema,
  roleConflicts: CountSchema,
  openImportChecks: CountSchema,
  suspectMeasurements: CountSchema,
});

export type ProgressSnapshot = z.infer<typeof ProgressSnapshotSchema>;
