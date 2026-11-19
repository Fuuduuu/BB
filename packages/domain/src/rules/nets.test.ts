import { expect, test } from 'vitest';
import { newBoardDoc } from '../doc';
import { resolveNets } from './nets';

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
