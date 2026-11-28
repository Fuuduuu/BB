import type { Component } from '@pcbk/domain';
import { pinReadings, PinReadingsSchema } from '@pcbk/domain/measure';
import { componentTopology } from '@pcbk/domain/rules';
import type { DeriveSpec } from '@pcbk/engine';

export const pinReadingsDerive: DeriveSpec<'pinReadings'> = {
  key: 'pinReadings',
  inputs: [
    {
      key: 'components',
      select: (doc) => componentTopology(doc.components as readonly Component[]),
    },
    'measurements',
  ],
  schema: PinReadingsSchema,
  initial: {},
  run: pinReadings,
};
