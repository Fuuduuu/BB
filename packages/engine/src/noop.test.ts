import { newBoardDoc } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { clock, component, demo, mutationModule, setup } from './__tests__/helpers';

test('items.delete with an absent id preserves revision, history, journal and subscribers', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(component());
  const { engine, host } = setup({ doc });
  engine.execute('demo.rename', { name: 'Confirmed' });
  const before = engine.snapshot();
  const journal = host.drainJournal();
  host.requeueJournal(journal);
  let notices = 0;
  engine.subscribe(() => {
    notices++;
  });
  engine.events(() => {
    notices++;
  });

  expect(engine.execute('items.delete', { ids: ['cmp_absent'] })).toEqual({
    ok: true,
    value: { rev: 1 },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.current()!.doc).toBe(before.doc);
  expect(host.current()!.rev).toBe(1);
  expect(host.drainJournal()).toEqual(journal);
  expect(notices).toBe(0);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Plaat');
  expect(engine.undo()).toMatchObject({ ok: false, error: { code: 'not_found', id: 'undo' } });
});

test('an empty command after undo preserves redo and discards buffered events', () => {
  const empty = mutationModule(() => undefined, []);
  empty.commands![0]!.run = (_doc, _params, ctx) => {
    ctx.emit({ type: 'test.empty', payload: { reason: 'no change' } });
  };
  empty.commands![0]!.summary = () => {
    throw new Error('Empty command must not be summarized');
  };
  let clockCalls = 0;
  const { engine, host } = setup({
    modules: [demo, empty],
    clock: {
      now() {
        clockCalls++;
        return clock.now();
      },
    },
  });
  engine.execute('demo.rename', { name: 'Changed' });
  engine.undo();
  const before = engine.snapshot();
  const journal = host.drainJournal();
  host.requeueJournal(journal);
  let notices = 0;
  engine.subscribe(() => {
    notices++;
  });
  engine.events(() => {
    notices++;
  });

  expect(engine.execute('test.mutate', {})).toEqual({ ok: true, value: { rev: 2 } });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual(journal);
  expect(notices).toBe(0);
  expect(clockCalls).toBe(2);
  expect(engine.redo()).toEqual({ ok: true, value: { rev: 3 } });
  expect(engine.snapshot().doc.name).toBe('Changed');
});
