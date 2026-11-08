import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, Measurement } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { clock, component, mutationModule, setup } from './__tests__/helpers';

function rejects(mutate: (doc: BoardDoc) => void) {
  const { engine, host } = setup({ modules: [mutationModule(mutate)] });
  const before = engine.snapshot();
  expect(engine.execute('test.mutate', {})).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
  expect(engine.undo()).toMatchObject({ ok: false, error: { code: 'not_found' } });
}
const entries = {
  components: component(),
  photos: { id: 'pho_a', side: 'top', name: 'Photo', widthPx: 1, heightPx: 1, transform: 'none' },
  junctions: { id: 'jun_a' },
  connections: {
    id: 'con_a',
    a: { junction: 'jun_a' },
    b: { junction: 'jun_b' },
    basis: 'assumed',
  },
  netLabels: { id: 'lbl_a', anchor: { junction: 'jun_a' }, source: 'user' },
  roles: { id: 'rol_a', label: 'Role', kind: 'unknown', color: '#123456' },
  measurements: {
    id: 'msr_a',
    mode: 'continuity',
    at: { c: 'cmp_old', p: '1', uid: 'pin_old' },
    power: 'off',
    takenAt: clock.now(),
    atLabel: 'R1.1',
    source: 'manual',
  },
  repairs: { id: 'rep_a', action: 'other', text: '', at: clock.now(), affects: { nothing: true } },
  dimensions: {
    id: 'dim_a',
    a: { point: { x: 0, y: 0 } },
    b: { point: { x: 1, y: 0 } },
    offsetPx: 0,
  },
  areas: { id: 'are_a', shape: 'rect', x: 0, y: 0, w: 1, h: 1, text: '' },
  textNotes: { id: 'txt_a', view: 'board', at: { x: 0, y: 0 }, text: '' },
  importChecks: { id: 'chk_a', at: { x: 0, y: 0 }, layer: 'top', junctions: [], note: '' },
} as const;
test.each(Object.entries(entries))('%s rejects duplicate entity IDs atomically', (key, entry) =>
  rejects((doc) => {
    Object.assign(doc, { [key]: [entry, entry] });
  }),
);
test.each(Object.entries(entries))('%s rejects a different entity prefix', (key, entry) =>
  rejects((doc) => {
    Object.assign(doc, { [key]: [{ ...entry, id: 'wrong_a' }] });
  }),
);
test.each(Object.entries(entries))('%s rejects an empty ID suffix', (key, entry) =>
  rejects((doc) => {
    Object.assign(doc, { [key]: [{ ...entry, id: entry.id.split('_')[0] + '_' }] });
  }),
);
test('short suffixes, default roles and repeated references remain valid', () => {
  const doc = newBoardDoc('Plaat');
  for (const [key, entry] of Object.entries(entries))
    if (key !== 'roles') Object.assign(doc, { [key]: [entry] });
  doc.components.push(component('cmp_b', 'R2'));
  const { engine } = setup({ doc });
  expect(engine.execute('demo.rename', { name: 'Accepted' }).ok).toBe(true);
  expect(engine.snapshot().doc.components.map((item) => item.pins[0]!.id)).toEqual(['1', '1']);
});
test.each([
  [
    'duplicate reference',
    (doc: BoardDoc) => {
      doc.components = [component(), component('cmp_b', 'r1')];
    },
  ],
  [
    'empty reference',
    (doc: BoardDoc) => {
      doc.components = [{ ...component(), ref: ' ' }];
    },
  ],
  [
    'duplicate local pin id',
    (doc: BoardDoc) => {
      const item = component();
      item.pins[1]!.id = '1';
      doc.components = [item];
    },
  ],
  [
    'duplicate global pin uid',
    (doc: BoardDoc) => {
      const second = component('cmp_b', 'R2');
      second.pins[0]!.uid = 'pin_cmp_a_1';
      doc.components = [component(), second];
    },
  ],
  [
    'wrong pin uid prefix',
    (doc: BoardDoc) => {
      const item = component();
      item.pins[0]!.uid = 'cmp_wrong';
      doc.components = [item];
    },
  ],
  [
    'empty pin uid suffix',
    (doc: BoardDoc) => {
      const item = component();
      item.pins[0]!.uid = 'pin_';
      doc.components = [item];
    },
  ],
] as const)('%s is rejected without history or journal', (_name, mutate) => rejects(mutate));
function measurement(changes: Partial<Measurement>): Measurement {
  return { ...entries.measurements, ...changes };
}
test.each([0, 1])('OL with numeric value %s is rejected', (value) =>
  rejects((doc) => {
    doc.measurements = [measurement({ mode: 'resistance', overload: true, value })];
  }),
);
test.each(['voltage', 'resistance', 'diode'] as const)(
  'beep true and false are rejected for %s',
  (mode) => {
    for (const beep of [true, false])
      rejects((doc) => {
        doc.measurements = [measurement({ mode, beep })];
      });
  },
);
test('OL without a value and both continuity answers are allowed', () => {
  const doc = newBoardDoc('Plaat');
  doc.measurements = [
    measurement({ mode: 'diode', overload: true }),
    measurement({ id: 'msr_b', beep: true }),
    measurement({ id: 'msr_c', beep: false }),
  ];
  const { engine } = setup({ doc });
  expect(engine.execute('demo.rename', { name: 'Valid' }).ok).toBe(true);
});
