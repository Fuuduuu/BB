import { expect, test } from 'vitest';
import { newBoardDoc } from '../doc';
import { INVARIANTS } from './invariants';
import { endKey, pinKey, resolveNets } from './nets';

test('resolveNets gives canonical sorted members from connection endpoints', () => {
  const doc = newBoardDoc('Võrkude proov');
  doc.components = ['z', 'b', 'a', 'isolated'].map((key, index) => ({
    id: `cmp_${key}`,
    ref: `R${index + 1}`,
    kind: 'resistor',
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: [{ id: '1', uid: `pin_${key}`, nc: false }],
  }));
  const pin = (c: string) => ({ pin: { c, p: '1' } });
  const junction = { junction: 'jun_mid' };
  doc.junctions = [{ id: junction.junction }];
  doc.connections = [
    { id: 'con_first', a: pin('cmp_z'), b: junction, basis: 'visual' },
    { id: 'con_second', a: pin('cmp_b'), b: pin('cmp_a'), basis: 'assumed' },
    { id: 'con_third', a: junction, b: pin('cmp_b'), basis: 'visual' },
  ];
  doc.netLabels = [
    { id: 'lbl_group', anchor: pin('cmp_a'), name: 'VBUS', source: 'user' },
    { id: 'lbl_isolated', anchor: pin('cmp_isolated'), name: 'VBUS', source: 'user' },
  ];

  const nets = resolveNets(doc);
  expect([...nets.members]).toEqual([
    ['cmp_a:1', ['cmp_a:1', 'cmp_b:1', 'cmp_z:1', 'jun_mid']],
    ['cmp_isolated:1', ['cmp_isolated:1']],
  ]);
  expect(nets.netOf.get('jun_mid')).toBe('cmp_a:1');
  expect(nets.netOf.get('cmp_isolated:1')).toBe('cmp_isolated:1');
  expect(resolveNets({ ...doc, connections: [...doc.connections].reverse() })).toEqual(nets);
});

test('net_keys_keep_pin_and_junction_ids_apart', () => {
  const doc = newBoardDoc('Võrgutunnuste proov');
  const first = { pin: { c: 'cmp_a', p: 'b:1' } };
  const second = { pin: { c: 'cmp_a:b', p: '1' } };
  const firstPartner = { pin: { c: 'cmp_first', p: '1' } };
  const secondPartner = { pin: { c: 'cmp_second', p: '1' } };
  const backslash = { pin: { c: 'cmp_a\\', p: '1' } };
  const earlier = { pin: { c: 'cmp_order:\\a', p: '1' } };
  const later = { pin: { c: 'cmp_orderZ', p: '1' } };
  const missing = { junction: 'cmp_a:1' };
  doc.components = [
    { id: first.pin.c, pins: [first.pin.p, '1'] },
    { id: second.pin.c, pins: [second.pin.p] },
    { id: firstPartner.pin.c, pins: [firstPartner.pin.p] },
    { id: secondPartner.pin.c, pins: [secondPartner.pin.p] },
    { id: backslash.pin.c, pins: [backslash.pin.p] },
    { id: earlier.pin.c, pins: [earlier.pin.p] },
    { id: later.pin.c, pins: [later.pin.p] },
  ].map(({ id, pins }, index) => ({
    id,
    ref: `R${index + 1}`,
    kind: 'resistor',
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: pins.map((pin, pinIndex) => ({ id: pin, uid: `pin_${index}_${pinIndex}`, nc: false })),
  }));
  doc.connections = [
    { id: 'con_first', a: first, b: firstPartner, basis: 'assumed' },
    { id: 'con_second', a: second, b: secondPartner, basis: 'assumed' },
  ];

  const { members, netOf } = resolveNets(doc);
  for (const [pin, partner] of [
    [first, firstPartner],
    [second, secondPartner],
  ] as const) {
    expect
      .soft(members.get(netOf.get(endKey(pin))!))
      .toEqual([endKey(pin), endKey(partner)].sort());
  }
  expect(pinKey({ c: 'cmp_1', p: '1' })).toBe('cmp_1:1');

  const ordered = [endKey(earlier), endKey(later)];
  expect.soft([...members.keys()].filter((key) => ordered.includes(key))).toEqual(ordered);
  const joined = resolveNets({
    ...doc,
    connections: [{ id: 'con_order', a: earlier, b: later, basis: 'assumed' }],
  });
  expect.soft(joined.members.get(ordered[0]!)).toEqual(ordered);

  doc.connections.push({ id: 'con_missing', a: missing, b: first, basis: 'assumed' });
  doc.netLabels.push({ id: 'lbl_missing', anchor: missing, source: 'user' });
  expect(INVARIANTS.flatMap(({ check }) => check(doc))).toEqual([
    { path: ['connections', 2, 'a'], code: 'dangling_connection_end' },
    { path: ['netLabels', 0, 'anchor'], code: 'dangling_label_anchor' },
  ]);
});
