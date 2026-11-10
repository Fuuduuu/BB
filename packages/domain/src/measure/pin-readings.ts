import { z } from 'zod';
import type { Pin } from '../model/component';
import type { Measurement } from '../model/measurement';
import { IdSchema, TimestampSchema } from '../model/primitives';
import type { MeasuredPin } from '../model/primitives';
import { stringRecord } from '../model/record';

export interface PinReading {
  measurementId: string;
  mode: 'voltage';
  value: number;
  takenAt: string;
}

export const PinReadingsSchema = stringRecord(
  IdSchema,
  z.strictObject({
    measurementId: IdSchema,
    mode: z.literal('voltage'),
    value: z.number(),
    takenAt: TimestampSchema,
  }),
) satisfies z.ZodType<Record<string, PinReading>>;

export interface PinReadingSource {
  readonly components: readonly {
    readonly id: string;
    readonly pins: readonly Readonly<Pick<Pin, 'id' | 'uid'>>[];
  }[];
  readonly measurements: readonly Readonly<Measurement>[];
}

export function pinReadings(doc: PinReadingSource): Record<string, PinReading> {
  const pinUids = new Map(
    doc.components.map(({ id, pins }) => [id, new Map(pins.map(({ id, uid }) => [id, uid]))]),
  );
  const isActive = ({ c, p, uid }: MeasuredPin) => pinUids.get(c)?.get(p) === uid;
  const latest = new Map<string, { time: number; reading: PinReading }>();

  for (const { id, mode, at, ref, value, takenAt, staleByRepairId } of doc.measurements) {
    if (
      mode !== 'voltage' ||
      staleByRepairId !== undefined ||
      value === undefined ||
      !Number.isFinite(value)
    ) {
      continue;
    }
    if (!isActive(at) || (ref !== undefined && !isActive(ref))) {
      continue;
    }

    const time = Date.parse(takenAt);
    const current = latest.get(at.uid);
    if (!Number.isFinite(time) || (current && time < current.time)) {
      continue;
    }

    latest.set(at.uid, { time, reading: { measurementId: id, mode, value, takenAt } });
  }

  return Object.fromEntries(Array.from(latest, ([uid, { reading }]) => [uid, reading] as const));
}
