import type { Derived, DocumentEngine, Snapshot } from '@pcbk/contracts';
import type { PinReading } from '@pcbk/domain';
import { expectTypeOf, test } from 'vitest';
import type { AddMeasurementParams } from './contract';

test('module_augments_derived_without_contract_change', () => {
  expectTypeOf<Derived['pinReadings']>().toEqualTypeOf<Record<string, PinReading>>();
  expectTypeOf<Snapshot['derived']['pinReadings']>().toEqualTypeOf<
    Readonly<Record<string, Readonly<PinReading>>>
  >();
});

declare const engine: DocumentEngine;
declare const params: AddMeasurementParams;
engine.execute('measurements.add', params);
engine.execute('measurements.remove', { id: params.id });
// @ts-expect-error only voltage measurements can be added
engine.execute('measurements.add', { ...params, mode: 'diode' });
// @ts-expect-error adding a voltage measurement requires a value
engine.execute('measurements.add', { ...params, value: undefined });
