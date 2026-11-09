import { BoardDocSchema } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { makeAddComponent } from './contract';
import { idGenerator, setup } from '../__tests__/helpers';

test.each(['add', 'update'] as const)('%s stores a trimmed component ref', (operation) => {
  const { engine } = setup();
  const params = makeAddComponent(idGenerator(), 'resistor');
  if (operation === 'update') engine.execute('components.add', { ...params, ref: 'R2' });
  const result =
    operation === 'add'
      ? engine.execute('components.add', { ...params, ref: 'R1 ' })
      : engine.execute('components.update', { id: params.id, ref: 'R1 ' });
  expect(result.ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.ref).toBe('R1');
});
test.each(['add', 'update'] as const)(
  '%s rejects a duplicate ref with case and spaces',
  (operation) => {
    const { engine, host } = setup();
    const ids = idGenerator();
    engine.execute('components.add', { ...makeAddComponent(ids, 'resistor'), ref: 'R1' });
    const params = makeAddComponent(ids, 'resistor');
    if (operation === 'update') engine.execute('components.add', { ...params, ref: 'R2' });
    const before = engine.snapshot();
    const journal = host.drainJournal();
    host.requeueJournal(journal);
    const result =
      operation === 'add'
        ? engine.execute('components.add', { ...params, ref: ' r1 ' })
        : engine.execute('components.update', { id: params.id, ref: ' r1 ' });
    expect(result).toMatchObject({ ok: false, error: { code: 'validation' } });
    expect(engine.snapshot()).toBe(before);
    expect(host.drainJournal()).toEqual(journal);
  },
);
test('loading a document with duplicate refs ignoring spaces is rejected atomically', () => {
  const { engine, host } = setup();
  const ids = idGenerator();
  engine.execute('components.add', { ...makeAddComponent(ids, 'resistor'), ref: 'R1' });
  engine.execute('components.add', { ...makeAddComponent(ids, 'resistor'), ref: 'R2' });
  const before = engine.snapshot();
  const doc = BoardDocSchema.parse(before.doc);
  doc.components[1]!.ref = ' r1 ';
  expect(() => host.load('invalid-refs', doc, false)).toThrow();
  expect(engine.snapshot()).toBe(before);
});
test('automatic ref allocation skips a loaded ref with surrounding spaces', () => {
  const { engine, host } = setup();
  const ids = idGenerator();
  engine.execute('components.add', { ...makeAddComponent(ids, 'resistor'), ref: 'R1' });
  const doc = BoardDocSchema.parse(engine.snapshot().doc);
  doc.components[0]!.ref = 'R1 ';
  host.load('legacy-spaces', doc, false);
  expect(engine.execute('components.add', makeAddComponent(ids, 'resistor')).ok).toBe(true);
  expect(engine.snapshot().doc.components[1]!.ref).toBe('R2');
});
