import { IdSchema, MeasuredPinSchema, MeasurementSchema, TimestampSchema } from '@pcbk/domain';
import type { PinReading } from '@pcbk/domain';
import { z } from 'zod';

const MeasurementInputSchema = MeasurementSchema.pick({
  id: true,
  at: true,
  ref: true,
  power: true,
  takenAt: true,
  note: true,
});
export const AddMeasurementSchema = z.discriminatedUnion('mode', [
  MeasurementInputSchema.extend({
    mode: z.literal('voltage'),
    value: z.number(),
  }),
  MeasurementInputSchema.extend({
    mode: z.literal('continuity'),
    ref: MeasurementInputSchema.shape.ref.unwrap(),
    beep: z.boolean(),
  }),
]);
export const RemoveMeasurementSchema = z.strictObject({ id: IdSchema });
export const BeepRecordSchema = z.strictObject({
  measurementId: IdSchema,
  connectionId: IdSchema,
  anchor: MeasuredPinSchema,
  pin: MeasuredPinSchema,
  beep: z.boolean(),
  connect: z.boolean(),
  takenAt: TimestampSchema,
});

export type AddMeasurementParams = z.infer<typeof AddMeasurementSchema>;
export type RemoveMeasurementParams = z.infer<typeof RemoveMeasurementSchema>;
export type BeepRecordParams = z.infer<typeof BeepRecordSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'measurements.add': AddMeasurementParams;
    'measurements.remove': RemoveMeasurementParams;
    'beep.record': BeepRecordParams;
  }

  interface Derived {
    pinReadings: Record<string, PinReading>;
  }
}
