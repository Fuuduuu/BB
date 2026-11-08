import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc } from '@pcbk/domain';
import type { Snapshot } from '@pcbk/contracts';
import { expect, test, vi } from 'vitest';
import { z } from 'zod';
import { clock, component, mutationModule, setup } from './__tests__/helpers';

test('invalid params return validation without changing snapshot, history or journal', () => {
  const { engine, host } = setup();
  const before = engine.snapshot();
  expect(engine.execute('demo.rename', { name: 7 } as never)).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(engine.undo()).toMatchObject({ ok: false, error: { code: 'not_found' } });
  expect(host.drainJournal()).toEqual([]);
});
test('ownership violation is rejected in production too', () => {
  const { engine, host } = setup({
    modules: [
      {
        id: 'evil',
        commands: [
          {
            id: 'evil.touch',
            title: 'Evil',
            params: z.strictObject({}),
            run(doc) {
              doc.components.push(component());
            },
          },
        ],
      },
    ],
  });
  const before = engine.snapshot();
  vi.stubEnv('NODE_ENV', 'production');
  try {
    expect(engine.execute('evil.touch', {})).toMatchObject({
      ok: false,
      error: { code: 'ownership', field: 'components' },
    });
    expect(engine.snapshot()).toBe(before);
    expect(host.drainJournal()).toEqual([]);
  } finally {
    vi.unstubAllEnvs();
  }
});
test('alsoWrites permits explicit cross-module writes', () => {
  const module = mutationModule((doc) => {
    doc.name = 'Allowed';
  }, []);
  module.commands![0]!.alsoWrites = ['name'];
  const { engine } = setup({ modules: [module] });
  expect(engine.execute('test.mutate', {})).toEqual({ ok: true, value: { rev: 1 } });
  expect(engine.snapshot().doc.name).toBe('Allowed');
});
test('reserved fields override alsoWrites', () => {
  const module = mutationModule((doc) => {
    doc.name = 'Forbidden';
  }, []);
  module.commands![0]!.alsoWrites = ['name'];
  const { engine, host } = setup({ modules: [module], reserved: ['name'] });
  expect(engine.execute('test.mutate', {})).toMatchObject({
    ok: false,
    error: { code: 'ownership', field: 'name' },
  });
  expect(engine.snapshot().rev).toBe(0);
  expect(host.drainJournal()).toEqual([]);
});
test.each(['rev', 'format_version'] as const)('commands cannot write core field %s', (field) => {
  const module = mutationModule((doc) => {
    Object.assign(doc, { [field]: 2 });
  });
  module.commands![0]!.alsoWrites = [field];
  const { engine } = setup({ modules: [module] });
  expect(engine.execute('test.mutate', {})).toMatchObject({
    ok: false,
    error: { code: 'ownership', field },
  });
  expect(engine.snapshot().rev).toBe(0);
});
test('undo and redo restore contents while revisions only increase', () => {
  const { engine, host } = setup();
  engine.execute('demo.rename', { name: 'One' });
  engine.execute('demo.rename', { name: 'Two' });
  expect(engine.undo()).toEqual({ ok: true, value: { rev: 3 } });
  expect(engine.snapshot().doc.name).toBe('One');
  expect(engine.redo()).toEqual({ ok: true, value: { rev: 4 } });
  expect(engine.snapshot().doc.name).toBe('Two');
  expect(host.current()?.rev).toBe(4);
  expect(host.drainJournal().map((entry) => entry.kind)).toEqual([
    'command',
    'command',
    'undo',
    'redo',
  ]);
});
test('history keeps only the last 200 steps', () => {
  const { engine } = setup();
  for (let index = 0; index < 210; index++) engine.execute('demo.rename', { name: String(index) });
  let undos = 0;
  while (engine.undo().ok) undos++;
  expect(undos).toBe(200);
  expect(engine.snapshot().doc.name).toBe('9');
  expect(engine.snapshot().rev).toBe(410);
});
test('rejected commands preserve redo and confirmed new commands discard it', () => {
  const { engine } = setup();
  engine.execute('demo.rename', { name: 'One' });
  engine.undo();
  engine.execute('demo.rename', { name: '' });
  expect(engine.redo().ok).toBe(true);
  engine.undo();
  engine.execute('demo.rename', { name: 'Branch' });
  expect(engine.redo()).toMatchObject({ ok: false, error: { code: 'not_found' } });
});
test('subscribers and host get the same deeply frozen snapshot document', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(component());
  const { engine, host } = setup({ doc });
  let seen: Snapshot | undefined;
  const stop = engine.subscribe((value) => {
    seen = value;
  });
  engine.execute('demo.rename', { name: 'Changed' });
  expect(seen).toBe(engine.snapshot());
  expect(seen!.doc).toBe(host.current()!.doc);
  expect(Object.isFrozen(seen!.doc.components[0]!.pins[0])).toBe(true);
  expect(() => {
    (seen!.doc as unknown as BoardDoc).components.push(component('cmp_b', 'R2'));
  }).toThrow();
  expect(() => {
    (seen!.derived.unplacedBoard as string[]).push('cmp_b');
  }).toThrow();
  stop();
  engine.execute('demo.rename', { name: 'Later' });
  expect(seen!.doc.name).toBe('Changed');
});
test('read-only sessions validate params first and reject execute, undo and redo', () => {
  const { engine, host } = setup({ readOnly: true });
  expect(engine.execute('demo.rename', { name: '' })).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.execute('demo.rename', { name: 'Valid' })).toMatchObject({
    ok: false,
    error: { code: 'read_only' },
  });
  expect(engine.undo()).toMatchObject({ ok: false, error: { code: 'read_only' } });
  expect(engine.redo()).toMatchObject({ ok: false, error: { code: 'read_only' } });
  expect(engine.snapshot().rev).toBe(0);
  expect(host.drainJournal()).toEqual([]);
});
test('each confirmed command journals clock, requestId and summary', () => {
  const { engine, host } = setup();
  engine.execute('demo.rename', { name: 'Named' }, { requestId: 'request-1' });
  expect(host.drainJournal()).toEqual([
    {
      at: clock.now(),
      kind: 'command',
      commandId: 'demo.rename',
      requestId: 'request-1',
      source: 'user',
      summary: 'Rename: Named',
    },
  ]);
  expect(host.drainJournal()).toEqual([]);
});
test('invariant rejection preserves earlier history and journal and discards buffered events', () => {
  const module = mutationModule(() => undefined, ['components']);
  module.commands![0]!.run = (doc, _params, ctx) => {
    ctx.emit({ type: 'test.invalid', payload: { id: 'cmp_b' } });
    doc.components.push(component('cmp_b', 'r1'));
  };
  const doc = newBoardDoc('Plaat');
  doc.components.push(component());
  const { engine, host } = setup({
    doc,
    modules: [
      {
        id: 'name',
        owns: ['name'],
        commands: [
          {
            id: 'demo.rename',
            title: 'Rename',
            params: z.strictObject({ name: z.string() }),
            run(draft, params) {
              draft.name = params.name;
            },
          },
        ],
      },
      module,
    ],
  });
  engine.execute('demo.rename', { name: 'Confirmed' });
  const before = engine.snapshot();
  let notices = 0;
  engine.subscribe(() => {
    notices++;
  });
  engine.events(() => {
    notices++;
  });
  expect(engine.execute('test.mutate', {})).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(notices).toBe(0);
  expect(host.drainJournal().map((entry) => entry.commandId)).toEqual(['demo.rename']);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Plaat');
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Confirmed');
});
test('items.delete removes only components and undo restores their original pin UIDs', () => {
  const doc = newBoardDoc('Plaat');
  doc.components = [component(), component('cmp_b', 'R2')];
  doc.measurements = [
    {
      id: 'msr_history',
      mode: 'continuity',
      at: { c: 'cmp_a', p: '1', uid: 'pin_cmp_a_1' },
      power: 'off',
      beep: true,
      takenAt: clock.now(),
      atLabel: 'R1.1',
      source: 'manual',
    },
  ];
  const { engine } = setup({ doc });
  engine.execute('items.delete', { ids: ['cmp_a'] });
  expect(engine.snapshot().doc.components.map((item) => item.id)).toEqual(['cmp_b']);
  expect(engine.snapshot().doc.measurements).toEqual(doc.measurements);
  engine.undo();
  expect(engine.snapshot().doc.components).toEqual(doc.components);
});
