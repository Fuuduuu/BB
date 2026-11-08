import { BoardDocSchema } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { setup } from '../__tests__/helpers';

function withComponent() {
  const result = setup();
  result.engine.execute('components.add', {
    id: 'cmp_a',
    kind: 'ic',
    pins: [{ id: '1', uid: 'pin_old' }],
  });
  return result;
}
test('addPin preserves other pins and undo removes only the new pin', () => {
  const { engine } = withComponent();
  expect(
    engine.execute('components.addPin', { id: 'cmp_a', pin: { id: '2', uid: 'pin_new' } }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.components[0]!.pins).toEqual([
    { id: '1', uid: 'pin_old', nc: false },
    { id: '2', uid: 'pin_new', nc: false },
  ]);
  engine.undo();
  expect(engine.snapshot().doc.components[0]!.pins).toEqual([
    { id: '1', uid: 'pin_old', nc: false },
  ]);
});
test('removePin then addPin with the same number uses the new caller uid', () => {
  const { engine } = withComponent();
  expect(engine.execute('components.removePin', { id: 'cmp_a', pinId: '1' }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.pins).toEqual([]);
  engine.execute('components.addPin', { id: 'cmp_a', pin: { id: '1', uid: 'pin_replacement' } });
  expect(engine.snapshot().doc.components[0]!.pins[0]!.uid).toBe('pin_replacement');
  engine.undo();
  engine.undo();
  expect(engine.snapshot().doc.components[0]!.pins[0]!.uid).toBe('pin_old');
});
test('renamePin and clearing its name preserve the pin identity', () => {
  const { engine } = withComponent();
  expect(engine.execute('components.renamePin', { id: 'cmp_a', pinId: '1', name: 'VCC' }).ok).toBe(
    true,
  );
  expect(engine.snapshot().doc.components[0]!.pins[0]).toEqual({
    id: '1',
    uid: 'pin_old',
    name: 'VCC',
    nc: false,
  });
  engine.execute('components.renamePin', { id: 'cmp_a', pinId: '1', name: null });
  expect(engine.snapshot().doc.components[0]!.pins[0]).not.toHaveProperty('name');
  engine.undo();
  expect(engine.snapshot().doc.components[0]!.pins[0]!.name).toBe('VCC');
});
test('setNc supports both values without changing identity or name', () => {
  const { engine } = withComponent();
  engine.execute('components.renamePin', { id: 'cmp_a', pinId: '1', name: 'VCC' });
  engine.execute('components.setNc', { id: 'cmp_a', pinId: '1', nc: true });
  expect(engine.snapshot().doc.components[0]!.pins[0]!.nc).toBe(true);
  engine.execute('components.setNc', { id: 'cmp_a', pinId: '1', nc: false });
  expect(engine.snapshot().doc.components[0]!.pins[0]).toEqual({
    id: '1',
    uid: 'pin_old',
    nc: false,
    name: 'VCC',
  });
});
test.each([
  { id: '1', uid: 'pin_distinct' },
  { id: '2', uid: 'pin_old' },
])('addPin rejects a repeated number or uid %# without mutation', (pin) => {
  const { engine } = withComponent();
  const before = engine.snapshot();
  expect(engine.execute('components.addPin', { id: 'cmp_a', pin })).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
});
test('uid cannot be reused by another live component', () => {
  const { engine } = withComponent();
  const before = engine.snapshot();
  expect(
    engine.execute('components.add', {
      id: 'cmp_b',
      kind: 'ic',
      pins: [{ id: '1', uid: 'pin_old' }],
    }),
  ).toMatchObject({ ok: false, error: { code: 'validation' } });
  expect(engine.snapshot()).toBe(before);
});
test('replacing a pin keeps its old measurement contact historical', () => {
  const { engine, host } = withComponent();
  const doc = BoardDocSchema.parse(engine.snapshot().doc);
  doc.measurements.push({
    id: 'msr_old',
    mode: 'continuity',
    power: 'off',
    beep: true,
    at: { c: 'cmp_a', p: '1', uid: 'pin_old' },
    atLabel: 'U1.1',
    takenAt: '2026-11-08T10:00:00.000Z',
    source: 'manual',
  });
  host.load('historical-contact', doc, false);
  engine.execute('components.removePin', { id: 'cmp_a', pinId: '1' });
  engine.execute('components.addPin', { id: 'cmp_a', pin: { id: '1', uid: 'pin_new' } });
  expect(engine.snapshot().doc.measurements[0]!.at).toEqual({ c: 'cmp_a', p: '1', uid: 'pin_old' });
  expect(engine.snapshot().doc.components[0]!.pins[0]!.uid).toBe('pin_new');
  engine.undo();
  engine.undo();
  expect(engine.snapshot().doc.components[0]!.pins[0]!.uid).toBe('pin_old');
});
test.each([
  ['components.update', { id: 'cmp_absent', note: 'x' }, 'cmp_absent'],
  ['components.removePin', { id: 'cmp_absent', pinId: '7' }, 'cmp_absent'],
  ['components.addPin', { id: 'cmp_absent', pin: { id: '1', uid: 'pin_new' } }, 'cmp_absent'],
  ['components.renamePin', { id: 'cmp_a', pinId: '7', name: 'VCC' }, 'cmp_a:7'],
  ['components.setNc', { id: 'cmp_a', pinId: '7', nc: true }, 'cmp_a:7'],
  ['components.removePin', { id: 'cmp_a', pinId: '7' }, 'cmp_a:7'],
] as const)('%s reports not_found for %j without mutation', (command, params, target) => {
  const { engine, host } = withComponent();
  const before = engine.snapshot();
  const journal = host.drainJournal();
  host.requeueJournal(journal);
  expect(engine.execute(command, params)).toEqual({
    ok: false,
    error: { code: 'not_found', id: target },
  });
  expect(engine.snapshot()).toBe(before);
  expect(engine.snapshot().rev).toBe(before.rev);
  expect(host.drainJournal()).toEqual(journal);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual([]);
});
