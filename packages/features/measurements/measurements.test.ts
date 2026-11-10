import { newBoardDoc } from '@pcbk/domain';
import { buildRegistry, createEngine } from '@pcbk/engine';
import type { EngineModule } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { engineFeatures, RESERVED_FIELDS } from '../engine';

const takenAt = '2026-11-10T10:00:00.000Z';
const withoutReference = {
  id: 'msr_a',
  mode: 'voltage',
  at: { c: 'cmp_ic', p: '8', uid: 'pin_a' },
  value: 3.3,
  power: 'on',
  takenAt,
  note: 'VCC',
} as const;
const measurement = {
  ...withoutReference,
  ref: { c: 'cmp_ref', p: '1', uid: 'pin_b' },
} as const;

function create(extra: EngineModule[] = []) {
  return createEngine({
    modules: [...engineFeatures, ...extra],
    reserved: RESERVED_FIELDS,
    clock: { now: () => takenAt },
  });
}

function withContacts() {
  const result = create();
  const { engine, host } = result;
  host.load('measurement-test', newBoardDoc('Plaat'), false);
  expect(
    engine.execute('components.add', {
      id: 'cmp_ic',
      kind: 'ic',
      ref: 'U1',
      pins: [{ id: '8', uid: 'pin_a' }],
    }).ok,
  ).toBe(true);
  expect(
    engine.execute('components.add', {
      id: 'cmp_ref',
      kind: 'connector',
      ref: 'J1',
      pins: [{ id: '1', uid: 'pin_b' }],
    }).ok,
  ).toBe(true);
  return result;
}

test('measurement_registry_starts_with_unreserved_owner', () => {
  const registry = buildRegistry(engineFeatures, RESERVED_FIELDS);
  expect(registry.reserved.has('measurements')).toBe(false);
  expect(registry.reserved.has('measureSettings')).toBe(true);
  expect(registry.commands.get('measurements.add')?.fields).toEqual(new Set(['measurements']));
});

test('empty_snapshot_has_empty_pin_readings', () => {
  const { engine, host } = create();
  expect(engine.snapshot().derived.pinReadings).toEqual({});
  host.load('measurement-test', newBoardDoc('Plaat'), false);
  expect(engine.snapshot().derived.pinReadings).toEqual({});
  host.unload();
  expect(engine.snapshot().derived.pinReadings).toEqual({});
});

test.each([
  { at: { ...measurement.at, c: 'cmp_missing' } },
  { at: { ...measurement.at, p: '7' } },
  { at: { ...measurement.at, uid: 'pin_replaced' } },
  { ref: { ...measurement.ref, c: 'cmp_missing' } },
  { ref: { ...measurement.ref, p: '7' } },
  { ref: { ...measurement.ref, uid: 'pin_replaced' } },
])('add_rejects_unknown_pin_or_wrong_uid %#', (contacts) => {
  const { engine, host } = withContacts();
  const before = engine.snapshot();
  host.drainJournal();
  expect(engine.execute('measurements.add', { ...measurement, ...contacts })).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'pin_not_active' }] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('add_rejects_same_probe_twice', () => {
  const { engine } = withContacts();
  const before = engine.snapshot();
  expect(engine.execute('measurements.add', { ...measurement, ref: measurement.at })).toMatchObject(
    {
      ok: false,
      error: { code: 'validation', issues: [{ message: 'same_probe_twice' }] },
    },
  );
  expect(engine.snapshot()).toBe(before);
});

test.each([
  { mode: 'resistance' },
  { mode: 'continuity' },
  { mode: 'diode' },
  { value: Infinity },
  { value: -Infinity },
  { value: NaN },
  { value: undefined },
])('add_rejects_non_voltage_and_nonfinite_value %#', (invalid) => {
  const { engine } = withContacts();
  const before = engine.snapshot();
  expect(engine.execute('measurements.add', { ...measurement, ...invalid } as never)).toMatchObject(
    {
      ok: false,
      error: { code: 'validation' },
    },
  );
  expect(engine.snapshot()).toBe(before);
});

test.each([
  { id: 'wrong_id' },
  { id: 'msr_' },
  { takenAt: '2026-11-10T10:00:00+02:00' },
  { takenAt: '2026-11-10T10:00:00' },
  { source: 'beep_mode' },
])('add rejects invalid ids, timestamps, and extra fields %#', (invalid) => {
  const { engine } = withContacts();
  expect(engine.execute('measurements.add', { ...measurement, ...invalid })).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
});

test('voltage_without_reference_is_allowed', () => {
  const { engine } = withContacts();
  expect(engine.execute('measurements.add', { ...withoutReference, value: 0 }).ok).toBe(true);
  expect(engine.snapshot().doc.measurements).toStrictEqual([
    { ...withoutReference, value: 0, atLabel: 'U1.8', source: 'manual' },
  ]);
});

test('labels_survive_component_rename_and_delete', () => {
  const { engine } = withContacts();
  expect(engine.execute('measurements.add', measurement).ok).toBe(true);
  expect(engine.execute('components.update', { id: 'cmp_ic', ref: 'U7' }).ok).toBe(true);
  expect(engine.execute('items.delete', { ids: ['cmp_ref'] }).ok).toBe(true);
  expect(engine.snapshot().doc.measurements).toEqual([
    { ...measurement, atLabel: 'U1.8', refLabel: 'J1.1', source: 'manual' },
  ]);
  expect(engine.snapshot().derived.pinReadings).toEqual({});
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().derived.pinReadings.pin_a?.measurementId).toBe('msr_a');
});

test('remove_is_undoable', () => {
  const { engine } = withContacts();
  expect(engine.execute('measurements.add', measurement).ok).toBe(true);
  const saved = engine.snapshot();
  expect(engine.execute('measurements.remove', { id: measurement.id }).ok).toBe(true);
  expect(engine.snapshot().doc.measurements).toEqual([]);
  expect(engine.snapshot().derived.pinReadings).toEqual({});
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.measurements).toEqual(saved.doc.measurements);
  expect(engine.snapshot().derived.pinReadings).toEqual(saved.derived.pinReadings);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.measurements).toEqual([]);
});

test('remove reports not_found for an absent id', () => {
  const { engine } = withContacts();
  const before = engine.snapshot();
  expect(engine.execute('measurements.remove', { id: 'msr_missing' })).toEqual({
    ok: false,
    error: { code: 'not_found', id: 'msr_missing' },
  });
  expect(engine.snapshot()).toBe(before);
});

test('pin_readings_derived_after_add', () => {
  const { engine } = withContacts();
  expect(engine.execute('measurements.add', measurement).ok).toBe(true);
  expect(
    engine.execute('measurements.add', {
      ...measurement,
      id: 'msr_b',
      takenAt: '2026-11-10T11:00:00.000Z',
      value: -1.25,
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().derived.pinReadings).toEqual({
    pin_a: {
      measurementId: 'msr_b',
      mode: 'voltage',
      value: -1.25,
      takenAt: '2026-11-10T11:00:00.000Z',
    },
  });
});

test('ownership_blocks_other_modules_from_writing_measurements', () => {
  const { engine, host } = create([
    {
      id: 'foreign',
      commands: [
        {
          id: 'foreign.write',
          title: 'foreign.write',
          params: z.undefined(),
          run(doc) {
            doc.measurements.push({ ...measurement, atLabel: 'U1.8', source: 'manual' });
          },
        },
      ],
    },
  ]);
  host.load('measurement-test', newBoardDoc('Plaat'), false);
  const before = engine.snapshot();
  expect(engine.execute('foreign.write' as never, undefined as never)).toEqual({
    ok: false,
    error: { code: 'ownership', field: 'measurements', command: 'foreign.write' },
  });
  expect(engine.snapshot()).toBe(before);
});
