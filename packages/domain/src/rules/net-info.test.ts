import { expect, test } from 'vitest';
import { newBoardDoc } from '../doc';
import type { Component } from '../model/component';
import type { Measurement } from '../model/measurement';
import { describeNets } from './index';

function component(id: string, ref: string, kind: Component['kind'], count: number): Component {
  return {
    id,
    ref,
    kind,
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: Array.from({ length: count }, (_, index) => ({
      id: String(index + 1),
      uid: `pin_${id}_${index + 1}`,
      nc: false,
    })),
  };
}

const endpoint = (c: string, p: string) => ({ pin: { c, p } });

test('negative_beep_then_connect_flags_contradiction', () => {
  const doc = newBoardDoc('Continuity test');
  doc.components.push(component('cmp_a', 'U1', 'ic', 1), component('cmp_b', 'U2', 'ic', 1));
  const measurement: Measurement = {
    id: 'msr_continuity',
    mode: 'continuity',
    at: { c: 'cmp_a', p: '1', uid: 'pin_cmp_a_1' },
    ref: { c: 'cmp_b', p: '1', uid: 'pin_cmp_b_1' },
    atLabel: 'U1.1',
    refLabel: 'U2.1',
    beep: false,
    power: 'off',
    takenAt: '2026-11-20T09:00:00.000Z',
    source: 'manual',
  };
  doc.measurements.push(measurement);
  expect(describeNets(doc).list).toEqual([]);

  doc.connections.push({
    id: 'con_link',
    a: endpoint('cmp_a', '1'),
    b: endpoint('cmp_b', '1'),
    basis: 'visual',
  });
  expect(describeNets(doc).list).toEqual([
    {
      key: 'cmp_a:1',
      members: ['cmp_a:1', 'cmp_b:1'],
      name: 'N1',
      named: false,
      roleConflict: false,
      conflictingRoles: [],
      beepContradiction: true,
    },
  ]);

  measurement.at.uid = 'pin_replaced';
  expect(describeNets(doc).list[0]?.beepContradiction).toBe(false);
  measurement.at.uid = 'pin_cmp_a_1';
  measurement.ref!.uid = 'pin_replaced';
  expect(describeNets(doc).list[0]?.beepContradiction).toBe(false);
});

test('shorted_two_pin_component_is_reported', () => {
  const doc = newBoardDoc('Shorted parts test');
  doc.components.push(
    component('cmp_resistor', 'R1', 'resistor', 2),
    component('cmp_three', 'L1', 'inductor', 3),
    component('cmp_connector', 'J1', 'connector', 2),
    component('cmp_open', 'C1', 'capacitor', 2),
  );
  doc.junctions.push({ id: 'jun_sample' });
  doc.connections.push(
    {
      id: 'con_resistor_a',
      a: endpoint('cmp_resistor', '1'),
      b: { junction: 'jun_sample' },
      basis: 'assumed',
    },
    {
      id: 'con_resistor_b',
      a: { junction: 'jun_sample' },
      b: endpoint('cmp_resistor', '2'),
      basis: 'visual',
    },
    {
      id: 'con_three',
      a: endpoint('cmp_three', '1'),
      b: endpoint('cmp_three', '2'),
      basis: 'visual',
    },
    {
      id: 'con_connector',
      a: endpoint('cmp_connector', '1'),
      b: endpoint('cmp_connector', '2'),
      basis: 'visual',
    },
  );
  expect(describeNets(doc).shortedComponents).toEqual(['cmp_resistor']);
});
