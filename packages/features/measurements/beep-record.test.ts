import type { DocumentEngine, DomainEvent } from '@pcbk/contracts';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, Component, Connection, MeasuredPin, Measurement } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../engine';
import type { BeepRecordParams } from './contract';

const takenAt = '2026-11-21T10:00:00.000Z';
const sessionId = 'beep-record-test';
const anchor = { c: 'cmp_j1', p: '1', uid: 'pin_j1_1' };
const pin = { c: 'cmp_j2', p: '1', uid: 'pin_j2_1' };
const resistorLeft = { c: 'cmp_r5', p: '1', uid: 'pin_r5_1' };
const resistorRight = { c: 'cmp_r5', p: '2', uid: 'pin_r5_2' };

const defaults: BeepRecordParams = {
  measurementId: 'msr_beep',
  connectionId: 'con_beep',
  anchor,
  pin,
  beep: true,
  connect: true,
  takenAt,
};

const end = ({ c, p }: MeasuredPin) => ({ pin: { c, p } });

function component(ref: string, kind: Component['kind'], probes: MeasuredPin[]): Component {
  return {
    id: probes[0]!.c,
    ref,
    kind,
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: probes.map(({ p: id, uid }) => ({ id, uid, nc: false })),
  };
}

function board() {
  const doc = newBoardDoc('Sünteetiline piiksumise katse');
  doc.components.push(
    component('J1', 'connector', [anchor]),
    component('J2', 'connector', [pin]),
    component('R5', 'resistor', [resistorLeft, resistorRight]),
  );
  return doc;
}

function load(doc: BoardDoc = board()) {
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => takenAt },
  });
  host.load(sessionId, doc, false);
  const events: DomainEvent[] = [];
  engine.events((event) => events.push(event));
  return { engine, events };
}

function record(engine: DocumentEngine, overrides: Partial<BeepRecordParams> = {}) {
  const params = { ...defaults, ...overrides };
  const result = engine.execute('beep.record', params);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return params;
}

function measurement(params: BeepRecordParams, atLabel: string, refLabel: string): Measurement {
  return {
    id: params.measurementId,
    mode: 'continuity',
    at: params.pin,
    ref: params.anchor,
    beep: params.beep,
    power: 'unknown',
    takenAt: params.takenAt,
    atLabel,
    refLabel,
    source: 'beep_mode',
  };
}

function guarded(
  params: BeepRecordParams,
  reason: string,
  components: string[],
  roles: string[],
): DomainEvent {
  return {
    type: 'beep.guarded',
    sessionId,
    rev: 1,
    payload: {
      measurementId: params.measurementId,
      anchor: params.anchor,
      pin: params.pin,
      reason,
      components,
      roles,
    },
  };
}

test('beep_record_connects_in_one_undo_step', () => {
  const { engine, events } = load();
  const params = record(engine);
  const { doc, derived } = engine.snapshot();
  expect(doc.measurements).toStrictEqual([measurement(params, 'J2.1', 'J1.1')]);
  expect(doc.connections).toStrictEqual([
    { id: params.connectionId, a: end(anchor), b: end(pin), basis: 'assumed' },
  ]);
  expect(derived.connectionLevels).toStrictEqual({ con_beep: { level: 'measured' } });
  expect(events).toStrictEqual([]);

  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.measurements).toStrictEqual([]);
  expect(engine.snapshot().doc.connections).toStrictEqual([]);
  expect(events).toStrictEqual([]);
});

test('beep_record_without_connect_or_beep_adds_only_measurement', () => {
  for (const overrides of [{ connect: false }, { beep: false }]) {
    const { engine, events } = load();
    const params = record(engine, overrides);
    expect(engine.snapshot().doc.measurements).toStrictEqual([measurement(params, 'J2.1', 'J1.1')]);
    expect(engine.snapshot().doc.connections).toStrictEqual([]);
    expect(events).toStrictEqual([]);
  }
});

test('beep_record_same_net_adds_only_measurement', () => {
  const doc = board();
  const middle = { junction: 'jun_link' };
  doc.junctions.push({ id: middle.junction });
  doc.connections.push(
    { id: 'con_left', a: end(anchor), b: middle, basis: 'visual' },
    { id: 'con_right', a: middle, b: end(pin), basis: 'assumed' },
  );

  const { engine, events } = load(doc);
  const params = record(engine);
  expect(engine.snapshot().doc.measurements).toStrictEqual([measurement(params, 'J2.1', 'J1.1')]);
  expect(engine.snapshot().doc.connections).toStrictEqual(doc.connections);
  expect(events).toStrictEqual([]);
});

test('beep_guard_blocks_passive_ends_and_new_shorts', () => {
  const isolated = load();
  const passive = record(isolated.engine, { anchor: resistorLeft, pin: resistorRight });
  expect(isolated.engine.snapshot().doc.measurements).toStrictEqual([
    measurement(passive, 'R5.2', 'R5.1'),
  ]);
  expect(isolated.engine.snapshot().doc.connections).toStrictEqual([]);
  expect(isolated.events).toStrictEqual([guarded(passive, 'same_component', ['R5'], [])]);

  const doc = board();
  const existing: Connection = {
    id: 'con_to_resistor',
    a: end(anchor),
    b: end(resistorLeft),
    basis: 'visual',
  };
  doc.connections.push(existing);
  const linked = load(doc);
  const short = record(linked.engine, { pin: resistorRight });
  expect(linked.engine.snapshot().doc.measurements).toStrictEqual([
    measurement(short, 'R5.2', 'J1.1'),
  ]);
  expect(linked.engine.snapshot().doc.connections).toStrictEqual([existing]);
  expect(linked.events).toStrictEqual([guarded(short, 'shorts_component', ['R5'], [])]);
});

test('beep_guard_blocks_role_merge', () => {
  const doc = board();
  const ground = { junction: 'jun_ground' };
  const power = { junction: 'jun_power' };
  doc.junctions.push({ id: ground.junction }, { id: power.junction });
  doc.connections.push(
    { id: 'con_ground', a: end(anchor), b: ground, basis: 'visual' },
    { id: 'con_power', a: end(pin), b: power, basis: 'visual' },
  );
  doc.netLabels.push(
    { id: 'lbl_ground', anchor: ground, roleId: 'rol_gnd', source: 'user' },
    { id: 'lbl_power', anchor: power, roleId: 'rol_5v', source: 'user' },
  );
  const { engine, events } = load(doc);
  const params = record(engine);
  expect(engine.snapshot().doc.measurements).toStrictEqual([measurement(params, 'J2.1', 'J1.1')]);
  expect(engine.snapshot().doc.connections).toStrictEqual(doc.connections);
  expect(events).toStrictEqual([guarded(params, 'role_conflict', [], ['5V', 'GND'])]);
});
