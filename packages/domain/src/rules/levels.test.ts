import { expect, test } from 'vitest';
import { newBoardDoc } from '../doc';
import type { Connection } from '../model/connection';
import type { Measurement } from '../model/measurement';
import type { EndRef, MeasuredPin } from '../model/primitives';
import { connectionLevels } from './index';

const probes = {
  a: { c: 'cmp_u1', p: '1', uid: 'pin_a' },
  b: { c: 'cmp_u1', p: '2', uid: 'pin_b' },
  c: { c: 'cmp_u1', p: '3', uid: 'pin_c' },
} satisfies Record<string, MeasuredPin>;
type Probe = keyof typeof probes;

function board() {
  const doc = newBoardDoc('Sünteetiline ühenduse taseme katse');
  doc.components.push({
    id: 'cmp_u1',
    ref: 'U1',
    kind: 'connector',
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: Object.values(probes).map(({ p, uid }) => ({ id: p, uid, nc: false })),
  });
  return doc;
}

const pin = (name: Probe): EndRef => {
  const { c, p } = probes[name];
  return { pin: { c, p } };
};
const junction = (name: string): EndRef => ({ junction: name });

function link(id: string, a: EndRef, b: EndRef, basis: Connection['basis'] = 'visual'): Connection {
  return { id, a, b, basis };
}

function continuity(id: string, a: Probe, b: Probe, beep: boolean, minute = '00'): Measurement {
  return {
    id,
    mode: 'continuity',
    at: { ...probes[a] },
    ref: { ...probes[b] },
    atLabel: `U1.${probes[a].p}`,
    refLabel: `U1.${probes[b].p}`,
    beep,
    power: 'off',
    takenAt: `2026-11-21T10:${minute}:00.000Z`,
    source: 'manual',
  };
}

test('branch_keeps_measured_path_through_junctions', () => {
  const doc = board();
  const middle = junction('jun_branch');
  doc.measurements.push(continuity('msr_ab', 'a', 'b', true));
  doc.connections.push(link('con_ab', pin('a'), pin('b')));
  expect.soft(connectionLevels(doc)).toEqual({ con_ab: { level: 'measured' } });

  doc.junctions.push({ id: 'jun_branch' });
  doc.connections = [
    link('con_ab', pin('a'), middle),
    link('con_jb', middle, pin('b')),
    link('con_jc', middle, pin('c'), 'assumed'),
  ];
  expect.soft(connectionLevels(doc)).toEqual({
    con_ab: { level: 'measured' },
    con_jb: { level: 'measured' },
    con_jc: { level: 'assumed' },
  });

  doc.measurements.push(continuity('msr_ac', 'a', 'c', false));
  expect(connectionLevels(doc)).toEqual({
    con_ab: { level: 'measured', noContinuity: true },
    con_jb: { level: 'measured' },
    con_jc: { level: 'assumed', noContinuity: true },
  });
});

test('measured_pair_does_not_spread_across_pins', () => {
  const doc = board();
  const ab = link('con_ab', pin('a'), pin('b'));
  const bc = link('con_bc', pin('b'), pin('c'), 'assumed');
  doc.connections.push(ab, bc, link('con_ac', pin('a'), pin('c'), 'assumed'));
  doc.measurements.push(continuity('msr_ab', 'a', 'b', true), continuity('msr_bc', 'b', 'c', true));
  expect.soft(connectionLevels(doc)).toEqual({
    con_ab: { level: 'measured' },
    con_bc: { level: 'measured' },
    con_ac: { level: 'assumed' },
  });

  doc.connections = [ab, bc];
  doc.measurements = [continuity('msr_ac', 'a', 'c', true)];
  expect(connectionLevels(doc)).toEqual({
    con_ab: { level: 'visual' },
    con_bc: { level: 'assumed' },
  });
});

test('latest_continuity_decides_level', () => {
  const doc = board();
  doc.connections.push(link('con_ab', pin('a'), pin('b'), 'assumed'));
  const basis = { con_ab: { level: 'assumed' } };
  const warning = { con_ab: { level: 'assumed', noContinuity: true } };
  const measured = { con_ab: { level: 'measured' } };
  doc.measurements.push(
    continuity('msr_early', 'a', 'b', true, '00'),
    continuity('msr_open', 'b', 'a', false, '02'),
    continuity('msr_out_of_order', 'a', 'b', true, '01'),
  );
  expect.soft(connectionLevels(doc)).toEqual(warning);

  const recent = continuity('msr_closed', 'a', 'b', true, '03');
  doc.measurements.push(recent);
  expect.soft(connectionLevels(doc)).toEqual(measured);
  doc.measurements.push(continuity('msr_open_tie', 'b', 'a', false, '03'));
  expect.soft(connectionLevels(doc)).toEqual(warning);

  doc.measurements = [];
  expect.soft(connectionLevels(doc)).toEqual(basis);
  doc.measurements.push({ ...recent, staleByRepairId: 'rpr_synthetic' });
  expect.soft(connectionLevels(doc)).toEqual(basis);
  doc.measurements = [recent];
  expect.soft(connectionLevels(doc)).toEqual(measured);
  doc.components[0]!.pins[1]!.uid = 'pin_replacement';
  expect(connectionLevels(doc)).toEqual(basis);
});

test('shortest_junction_path_tie_breaks_by_connection_id', () => {
  const doc = board();
  const high = junction('jun_high');
  const low = junction('jun_low');
  const long1 = junction('jun_long1');
  const long2 = junction('jun_long2');
  doc.junctions.push(...['jun_high', 'jun_low', 'jun_long1', 'jun_long2'].map((id) => ({ id })));
  doc.connections.push(
    link('con_0_long', pin('a'), long1),
    link('con_1_long', long1, long2),
    link('con_2_long', long2, pin('b')),
    link('con_c_enter', pin('a'), high),
    link('con_a_exit', high, pin('b')),
    link('con_b_enter', pin('a'), low),
    link('con_z_exit', low, pin('b')),
  );
  doc.measurements.push(continuity('msr_ba', 'b', 'a', true));

  expect(connectionLevels(doc)).toEqual({
    con_0_long: { level: 'visual' },
    con_1_long: { level: 'visual' },
    con_2_long: { level: 'visual' },
    con_c_enter: { level: 'visual' },
    con_a_exit: { level: 'visual' },
    con_b_enter: { level: 'measured' },
    con_z_exit: { level: 'measured' },
  });
});
