import { newBoardDoc } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { component, mutationModule, setup } from './__tests__/helpers';

const poisonedId = {
  get crash(): string {
    throw new Error('metadata getter');
  },
};
test.each([
  ['number', 0],
  ['object', {}],
  ['getter', poisonedId],
])('invalid requestId metadata cannot partially commit: %s', (_name, requestId) => {
  const { engine, host } = setup();
  const before = engine.snapshot();
  expect(engine.execute('demo.rename', { name: 'Changed' }, { requestId } as never)).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.current()!.doc).toBe(before.doc);
  expect(host.current()!.rev).toBe(0);
  expect(host.drainJournal()).toEqual([]);
  expect(engine.undo().ok).toBe(false);
});

test('a shallow-frozen external object cannot leave mutable descendants or history values', () => {
  const external = Object.freeze(component());
  const { engine } = setup({
    modules: [
      mutationModule((doc) => {
        doc.components.push(external);
      }),
    ],
  });
  expect(engine.execute('test.mutate', {}).ok).toBe(true);
  expect(Object.isFrozen(external.pins)).toBe(true);
  expect(Object.isFrozen(external.pins[0])).toBe(true);
  expect(() => {
    external.pins[0]!.id = 'changed';
  }).toThrow();
  expect(() => {
    external.pins.push({ id: '3', uid: 'pin_extra', nc: false });
  }).toThrow();
  engine.undo();
  engine.redo();
  expect(engine.snapshot().doc.components[0]!.pins[0]!.id).toBe('1');
  expect(Object.isFrozen(engine.snapshot().doc.components[0]!.pins[0])).toBe(true);
});

test.each([
  ['custom prototype', () => Object.setPrototypeOf(component(), { custom: true }), 'validation'],
  [
    'accessor data',
    () => Object.defineProperty(component(), 'value', { enumerable: true, get: () => 'dynamic' }),
    'internal',
  ],
] as const)('%s cannot become an externally mutable document', (_name, make, code) => {
  const external = make();
  const { engine, host } = setup({
    modules: [
      mutationModule((doc) => {
        doc.components.push(external);
      }),
    ],
  });
  const before = engine.snapshot();
  expect(engine.execute('test.mutate', {})).toMatchObject({
    ok: false,
    error: { code },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('unknown root properties return validation rather than a fictitious DocKey', () => {
  const { engine, host } = setup({
    modules: [
      mutationModule((doc) => {
        Object.assign(doc, { unknown: true });
      }),
    ],
  });
  const before = engine.snapshot();
  expect(engine.execute('test.mutate', {})).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [expect.objectContaining({ path: ['unknown'] })] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('rejected asynchronous observers do not escape as unhandled rejections', async () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => {
    rejections.push(reason);
  };
  process.on('unhandledRejection', onRejection);
  try {
    const { engine } = setup();
    engine.subscribe(async () => {
      await Promise.resolve();
      throw new Error('async observer');
    });
    expect(engine.execute('demo.rename', { name: 'Committed' })).toEqual({
      ok: true,
      value: { rev: 1 },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rejections).toEqual([]);
    expect(engine.snapshot().doc.name).toBe('Committed');
  } finally {
    process.off('unhandledRejection', onRejection);
  }
});

test('safe freezing retains structural sharing for unchanged document branches', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(component());
  const { engine } = setup({ doc });
  const before = engine.snapshot();
  engine.execute('demo.rename', { name: 'Changed' });
  expect(engine.snapshot().doc.components).toBe(before.doc.components);
  expect(engine.snapshot().doc.roles).toBe(before.doc.roles);
});
