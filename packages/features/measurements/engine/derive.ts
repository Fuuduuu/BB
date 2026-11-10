import { pinReadings, PinReadingsSchema } from '@pcbk/domain/measure';
import type { DeriveSpec } from '@pcbk/engine';

export const pinReadingsDerive: DeriveSpec<'pinReadings'> = {
  key: 'pinReadings',
  inputs: ['components', 'measurements'],
  schema: PinReadingsSchema,
  initial: {},
  run: pinReadings,
};
