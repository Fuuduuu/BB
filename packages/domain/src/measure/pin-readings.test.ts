import { expect, test } from 'vitest';
import { pinReadings, PinReadingsSchema } from '@pcbk/domain/measure';
import type { Measurement } from '../model/measurement';

const red = { c: 'cmp_u1', p: '7', uid: 'pin_red' };
const black = { c: 'cmp_u2', p: '1', uid: 'pin_black' };
const components = [
  { id: red.c, pins: [{ id: red.p, uid: red.uid }] },
  { id: black.c, pins: [{ id: black.p, uid: black.uid }] },
];

test('the pin-readings schema validates the dictionary and voltage entries', () => {
  const reading = {
    measurementId: 'msr_a',
    mode: 'voltage',
    value: -1.25,
    takenAt: '2026-11-10T10:00:00.000Z',
  };
  expect(PinReadingsSchema.safeParse({ pin_red: reading }).success).toBe(true);
  expect(PinReadingsSchema.safeParse([]).success).toBe(false);
  expect(PinReadingsSchema.safeParse({ pin_red: { ...reading, mode: 'diode' } }).success).toBe(
    false,
  );
  expect(PinReadingsSchema.safeParse({ pin_red: { ...reading, value: Infinity } }).success).toBe(
    false,
  );
  expect(
    PinReadingsSchema.safeParse({ pin_red: { ...reading, takenAt: 'yesterday' } }).success,
  ).toBe(false);
});

function measurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    id: 'msr_1',
    mode: 'voltage',
    at: red,
    value: 3.3,
    power: 'on',
    takenAt: '2026-11-10T10:00:00.1Z',
    atLabel: 'U1:7',
    source: 'manual',
    ...overrides,
  };
}

test('pin_readings_picks_latest_active', () => {
  const newest = measurement({
    id: 'msr_newest',
    ref: black,
    value: 4.98,
    takenAt: '2026-11-10T10:00:00.19Z',
  });
  const oldest = measurement();

  expect(pinReadings({ components, measurements: [newest, oldest] })).toEqual({
    [red.uid]: {
      measurementId: newest.id,
      mode: 'voltage',
      value: 4.98,
      takenAt: newest.takenAt,
    },
  });
});

test('pin_readings_tie_prefers_later_entry', () => {
  const later = measurement({ id: 'msr_later', takenAt: '2026-11-10T10:00:00.100Z', value: 0 });
  const readings = pinReadings({ components, measurements: [measurement(), later] });

  expect(readings[red.uid]).toEqual({
    measurementId: later.id,
    mode: 'voltage',
    value: 0,
    takenAt: later.takenAt,
  });
});

test('pin_readings_skips_historical_stale_and_other_modes', () => {
  const active = measurement();
  const skipped = [
    { at: { ...red, c: 'cmp_missing' } },
    { at: { ...red, p: '8' } },
    { at: { ...red, uid: 'pin_removed_red' } },
    { ref: { ...black, c: 'cmp_missing' } },
    { ref: { ...black, p: '2' } },
    { ref: { ...black, uid: 'pin_removed_black' } },
    { staleByRepairId: 'rep_1' },
    { mode: 'resistance' },
    { mode: 'diode' },
    { mode: 'continuity' },
    { value: undefined },
    { value: Number.POSITIVE_INFINITY },
    { value: Number.NaN },
    { takenAt: 'invalid timestamp' },
  ] satisfies Partial<Measurement>[];

  const measurements = [
    active,
    ...skipped.map((overrides, index) =>
      measurement({ id: `msr_skipped_${index}`, takenAt: '2026-11-11T10:00:00Z', ...overrides }),
    ),
  ];

  expect(pinReadings({ components, measurements })).toEqual({
    [red.uid]: {
      measurementId: active.id,
      mode: 'voltage',
      value: 3.3,
      takenAt: active.takenAt,
    },
  });
});

test('same_number_new_pin_does_not_inherit_old_reading', () => {
  const replacement = { ...red, uid: 'pin_new_red' };
  const updatedComponents = [
    { id: replacement.c, pins: [{ id: replacement.p, uid: replacement.uid }] },
  ];

  expect(pinReadings({ components: updatedComponents, measurements: [measurement()] })).toEqual({});
});

test('pin_readings_does_not_mutate_input', () => {
  const at = Object.freeze({ ...red, uid: '__proto__' });
  const ref = Object.freeze({ ...black });
  const input = Object.freeze({
    components: Object.freeze(
      [at, ref].map(({ c, p, uid }) =>
        Object.freeze({ id: c, pins: Object.freeze([Object.freeze({ id: p, uid })]) }),
      ),
    ),
    measurements: Object.freeze([
      Object.freeze(measurement({ at, ref })),
      Object.freeze(measurement({ id: 'msr_2', at, ref, takenAt: '2026-11-11T10:00:00Z' })),
    ]),
  });

  const readings = pinReadings(input);

  expect(Object.getPrototypeOf(readings)).toBe(Object.prototype);
  expect(Object.hasOwn(readings, at.uid)).toBe(true);
  expect(readings[at.uid]?.measurementId).toBe('msr_2');
});
