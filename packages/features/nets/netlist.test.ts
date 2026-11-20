import { newBoardDoc } from '@pcbk/domain';
import type { Component, Pin } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../engine';
import { netlistCsv } from './contract';

function component(id: string, ref: string, pins: Pin[]): Component {
  return {
    id,
    ref,
    pins,
    kind: 'connector',
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
  };
}

const pin = (c: string, p: string) => ({ pin: { c, p } });

test('netlist_csv_lists_every_member', () => {
  const doc = newBoardDoc('Võrguloendi proov');
  doc.components.push(
    component('cmp_j', 'J1', [
      { id: '2', uid: 'pin_j2', name: 'Väljund', nc: false },
      { id: '1', uid: 'pin_j1', nc: false },
    ]),
    component('cmp_r', 'R1', [{ id: '2', uid: 'pin_r2', name: 'SIGN"AAL\n2', nc: false }]),
  );
  doc.roles.push(
    { id: 'rol_a_ground', kind: 'ground', label: 'GND', color: '#113322' },
    { id: 'rol_b_power', kind: 'power', label: '5V', color: '#bb3322' },
  );
  doc.junctions.push({ id: 'jun_fixture' });
  doc.connections.push(
    { id: 'con_z', a: pin('cmp_j', '1'), b: { junction: 'jun_fixture' }, basis: 'assumed' },
    { id: 'con_a', a: pin('cmp_r', '2'), b: pin('cmp_j', '2'), basis: 'assumed' },
  );
  doc.netLabels.push(
    { id: 'lbl_z', anchor: pin('cmp_j', '1'), name: 'Toide;5V', roleId: 'rol_5v', source: 'user' },
    {
      id: 'lbl_a',
      anchor: pin('cmp_j', '2'),
      name: 'Andmed',
      roleId: 'rol_a_ground',
      source: 'user',
    },
    { id: 'lbl_b', anchor: pin('cmp_r', '2'), roleId: 'rol_b_power', source: 'user' },
  );
  const { host, engine } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-20T09:00:00.000Z' },
  });
  host.load('netlist-fixture', doc, false);
  const snapshot = engine.snapshot();

  const header = '\uFEFFVõrk;Roll;Tähis.jalg;Jala nimi';
  expect(netlistCsv(snapshot)).toBe(
    [
      header,
      'Andmed;GND + 5V;J1.2;Väljund',
      'Andmed;GND + 5V;R1.2;"SIGN""AAL\n2"',
      '"Toide;5V";5V;J1.1;',
    ].join('\r\n'),
  );
  expect(
    netlistCsv({
      doc: snapshot.doc,
      derived: { unplacedBoard: [], unplacedSchematic: [], pinReadings: {} },
    }),
  ).toBe(header);
});
