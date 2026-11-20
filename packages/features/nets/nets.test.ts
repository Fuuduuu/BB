import { newBoardDoc } from '@pcbk/domain';
import type { NetRole } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../engine';

const anchor = (p: string) => ({ pin: { c: 'cmp_fixture', p } });
const key = (p: string) => `cmp_fixture:${p}`;
const rejection = (message: string) => ({
  ok: false,
  error: { code: 'validation', issues: [{ code: 'custom', path: [], message }] },
});

function networkFixture() {
  const doc = newBoardDoc('Võrgukatse');
  doc.components.push({
    id: 'cmp_fixture',
    ref: 'J1',
    kind: 'connector',
    identified: true,
    dnp: false,
    marking: '',
    value: '',
    note: '',
    pins: ['1', '2', '3', '4', '5'].map((id) => ({ id, uid: `pin_${id}`, nc: false })),
  });
  doc.connections.push(
    { id: 'con_second', a: anchor('4'), b: anchor('3'), basis: 'visual' },
    { id: 'con_first', a: anchor('2'), b: anchor('1'), basis: 'visual' },
  );
  return doc;
}

function load(doc = networkFixture()) {
  const result = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-20T09:00:00.000Z' },
  });
  result.host.load('nets-fixture', doc, false);
  return result;
}

test('same_name_does_not_join_nets', () => {
  const { engine } = load();
  const before = engine.snapshot();
  expect(
    engine.execute('nets.assign', {
      anchor: anchor('1'),
      labelId: 'lbl_first',
      name: '  GND  ',
      roleId: 'rol_gnd',
    }).ok,
  ).toBe(true);
  expect(
    engine.execute('nets.assign', {
      anchor: anchor('3'),
      labelId: 'lbl_second',
      name: 'GND',
    }).ok,
  ).toBe(true);
  expect(
    engine.snapshot().derived.nets?.list.map(({ key, name, named }) => ({ key, name, named })),
  ).toEqual([
    { key: key('1'), name: 'GND', named: true },
    { key: key('3'), name: 'GND', named: true },
  ]);
  expect(engine.snapshot().doc.connections).toEqual(before.doc.connections);
  expect(before.derived.nets?.list.map(({ key, name }) => [key, name])).toEqual([
    [key('1'), 'N1'],
    [key('3'), 'N2'],
  ]);
  expect(before.derived.nets?.netOf).toEqual({
    [key('1')]: key('1'),
    [key('2')]: key('1'),
    [key('3')]: key('3'),
    [key('4')]: key('3'),
  });

  expect(
    engine.execute('nets.assign', {
      anchor: anchor('2'),
      labelId: 'lbl_renamed',
      name: ' Shield ',
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.netLabels).toEqual([
    { id: 'lbl_first', anchor: anchor('1'), roleId: 'rol_gnd', source: 'user' },
    { id: 'lbl_second', anchor: anchor('3'), name: 'GND', source: 'user' },
    { id: 'lbl_renamed', anchor: anchor('2'), name: 'Shield', source: 'user' },
  ]);
  expect(
    engine.execute('nets.assign', {
      anchor: anchor('2'),
      labelId: 'lbl_unused',
      name: '  ',
      roleId: null,
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.netLabels).toEqual([
    { id: 'lbl_second', anchor: anchor('3'), name: 'GND', source: 'user' },
  ]);

  expect(
    engine.execute('nets.assign', {
      anchor: anchor('5'),
      labelId: 'lbl_single',
      roleId: 'rol_sig',
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().derived.nets?.list.at(-1)).toMatchObject({
    key: key('5'),
    members: [key('5')],
    named: false,
    name: 'N2',
    roleId: 'rol_sig',
  });
  const saved = engine.snapshot();
  expect(
    engine.execute('nets.assign', {
      anchor: anchor('5'),
      labelId: 'lbl_unused',
      roleId: 'rol_unknown',
    }),
  ).toEqual(rejection('unknown_role'));
  expect(
    engine.execute('nets.assign', {
      anchor: anchor('9'),
      labelId: 'lbl_missing',
      name: 'GND',
    }),
  ).toMatchObject({ ok: false, error: { code: 'not_found' } });
  expect(engine.snapshot()).toBe(saved);
});

test('joining_gnd_and_5v_flags_conflict_and_undo_restores', () => {
  const doc = networkFixture();
  doc.netLabels.push(
    { id: 'lbl_power', anchor: anchor('3'), name: '5V', roleId: 'rol_5v', source: 'user' },
    { id: 'lbl_ground', anchor: anchor('1'), name: 'GND', roleId: 'rol_gnd', source: 'user' },
  );
  const { engine, host } = load(doc);
  const before = engine.snapshot();
  const a = anchor('2');
  const b = anchor('4');
  expect(engine.execute('nets.join', { connectionId: 'con_join', a, b }).ok).toBe(true);
  const after = engine.snapshot();
  expect(after.doc.connections.at(-1)).toEqual({ id: 'con_join', a, b, basis: 'assumed' });
  expect(after.doc.netLabels).toEqual(before.doc.netLabels);
  expect(after.derived.nets?.list).toEqual([
    {
      key: key('1'),
      members: [key('1'), key('2'), key('3'), key('4')],
      name: 'GND',
      named: true,
      roleConflict: true,
      conflictingRoles: ['rol_5v', 'rol_gnd'],
      beepContradiction: false,
    },
  ]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['nets.join']);
  expect(engine.execute('nets.join', { connectionId: 'con_duplicate', a, b })).toEqual(
    rejection('already_joined'),
  );
  expect(engine.snapshot()).toBe(after);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.connections).toEqual(before.doc.connections);
  expect(engine.snapshot().derived.nets?.list.map(({ roleId }) => roleId)).toEqual([
    'rol_gnd',
    'rol_5v',
  ]);
});

test('scale_change_leaves_nets_unchanged', () => {
  const { engine } = load();
  const before = engine.snapshot().derived.nets;
  expect(before?.list).toHaveLength(2);
  expect(
    engine.execute('photo.setScale', {
      a: { x: 10, y: 10 },
      b: { x: 110, y: 10 },
      mm: 4,
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.scale.pxPerMm).toBe(25);
  expect(engine.snapshot().derived.nets).toBe(before);
});

test('custom_roles_can_be_updated_and_removed_when_unused', () => {
  const { engine } = load();
  const role: NetRole = {
    id: 'rol_custom',
    label: 'VBUS',
    kind: 'power',
    nominalV: 5,
    color: '#1762cc',
  };
  expect(engine.execute('roles.add', { role }).ok).toBe(true);
  expect(engine.execute('roles.add', { role })).toEqual(rejection('duplicate_role'));
  expect(
    engine.execute('roles.update', {
      id: role.id,
      kind: 'signal',
      label: 'PWM',
      nominalV: null,
      color: '#7722cc',
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.roles.at(-1)).toEqual({
    id: role.id,
    kind: 'signal',
    label: 'PWM',
    color: '#7722cc',
  });
  expect(engine.execute('roles.remove', { id: role.id }).ok).toBe(true);
  expect(engine.execute('roles.update', { id: role.id, label: 'Unused' })).toMatchObject({
    ok: false,
    error: { code: 'not_found' },
  });
});
