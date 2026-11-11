import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc } from '@pcbk/domain';
import type { CommandId, DeepReadonly, DomainEvent, Snapshot } from '@pcbk/contracts';
import { expect, test } from 'vitest';
import { z } from 'zod';
import * as api from './index';
import { clock, component, demo, mutationModule, setup, withTestOwners } from './__tests__/helpers';

test('empty engine and unloading expose no active project and reset history', () => {
  expect(api.createEngine).toBeTypeOf('function');
  const { engine, host } = api.createEngine({ modules: withTestOwners([demo]), clock });
  expect(host.current()).toBeNull();
  expect(engine.snapshot().sessionId).toBe('');
  expect(engine.execute('demo.rename', { name: 'No project' })).toMatchObject({
    ok: false,
    error: { code: 'stale_session' },
  });
  host.load('first', newBoardDoc('Loaded'), false);
  engine.execute('demo.rename', { name: 'Change' });
  let seen: Snapshot | undefined;
  engine.subscribe((value) => {
    seen = value;
  });
  host.unload();
  expect(host.current()).toBeNull();
  expect(seen!.sessionId).toBe('');
  host.load('second', newBoardDoc('Next'), false);
  expect(host.drainJournal()).toEqual([]);
  expect(engine.undo().ok).toBe(false);
});
test('load copies input and rejects invalid replacement without losing current session', () => {
  const original = newBoardDoc('Source');
  const { engine, host } = setup({ doc: original });
  original.name = 'External';
  expect(engine.snapshot().doc.name).toBe('Source');
  const before = engine.snapshot();
  const invalid = newBoardDoc('Invalid');
  invalid.components.push(component('wrong_id'));
  expect(() => host.load('invalid', invalid, true)).toThrow();
  expect(engine.snapshot()).toBe(before);
  expect(engine.execute('demo.rename', { name: 'Still writable' }).ok).toBe(true);
});
test('journal requeue preserves order, deduplicates and ignores an earlier session', () => {
  const { engine, host } = setup();
  engine.execute('demo.rename', { name: 'One' });
  const first = host.drainJournal();
  engine.execute('demo.rename', { name: 'Two' });
  const second = host.drainJournal();
  host.requeueJournal(second);
  host.requeueJournal(first);
  host.requeueJournal(first);
  expect(host.drainJournal().map((item) => item.summary)).toEqual(['Rename: One', 'Rename: Two']);
  host.load('new-session', newBoardDoc('Other'), false);
  host.requeueJournal(first);
  expect(host.drainJournal()).toEqual([]);
});
test('runner, summary and clock failures are atomic', () => {
  const bad = mutationModule((doc) => {
    doc.name = 'Partial';
    throw new Error('runner');
  });
  const summary = mutationModule((doc) => {
    doc.name = 'Partial';
  });
  summary.commands![0]!.summary = () => {
    throw new Error('summary');
  };
  for (const options of [
    { modules: [bad] },
    { modules: [summary] },
    {
      modules: [
        mutationModule((doc) => {
          doc.name = 'Partial';
        }),
      ],
      clock: {
        now() {
          throw new Error('clock');
        },
      },
    },
  ]) {
    const { engine, host } = setup(options);
    const before = engine.snapshot();
    expect(engine.execute('test.mutate', {})).toMatchObject({
      ok: false,
      error: { code: 'internal' },
    });
    expect(engine.snapshot()).toBe(before);
    expect(host.drainJournal()).toEqual([]);
    expect(engine.undo().ok).toBe(false);
  }
});
test('async command runners are rejected without a partial commit', async () => {
  const module = mutationModule(async (doc) => {
    doc.name = 'Partial';
    await Promise.resolve();
    doc.name = 'Late';
  });
  const { engine, host } = setup({ modules: [module] });
  const before = engine.snapshot();
  expect(engine.execute('test.mutate', {})).toMatchObject({
    ok: false,
    error: { code: 'internal' },
  });
  await Promise.resolve();
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});
test('notifications precede events and event payloads safely capture draft data', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(component());
  const module = mutationModule(() => undefined);
  module.commands![0]!.run = (draft, _params, ctx) => {
    draft.components[0]!.note = 'Changed';
    ctx.emit({ type: 'demo.changed', payload: { item: draft.components[0] } });
  };
  const { engine } = setup({ doc, modules: [module] });
  const order: string[] = [];
  let event: DomainEvent | undefined;
  engine.subscribe(() => {
    order.push('snapshot');
  });
  engine.events((value) => {
    order.push('event');
    event = value;
  });
  expect(engine.execute('test.mutate', {}).ok).toBe(true);
  expect(order).toEqual(['snapshot', 'event']);
  expect(event).toMatchObject({
    sessionId: 'session-a',
    rev: 1,
    type: 'demo.changed',
    payload: { item: { note: 'Changed' } },
  });
  expect(Object.isFrozen((event!.payload as { item: object }).item)).toBe(true);
});
test('throwing observers are isolated and reentrant commands are rejected', () => {
  const { engine } = setup();
  let calls = 0;
  engine.subscribe(() => {
    throw new Error('observer');
  });
  engine.subscribe(() => {
    calls++;
    expect(engine.execute('demo.rename', { name: 'Reentrant' }).ok).toBe(false);
  });
  expect(engine.execute('demo.rename', { name: 'Confirmed' })).toEqual({
    ok: true,
    value: { rev: 1 },
  });
  expect(calls).toBe(1);
  expect(engine.snapshot().doc.name).toBe('Confirmed');
});
test('derived placement lists stay coherent across commands and undo', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(component());
  const module = mutationModule((draft) => {
    draft.components[0]!.board = {
      footprint: 'custom',
      params: {},
      center: { x: 0, y: 0 },
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    };
  });
  const { engine } = setup({ doc, modules: [module] });
  expect(engine.snapshot().derived.unplacedBoard).toEqual(['cmp_a']);
  engine.execute('test.mutate', {});
  expect(engine.snapshot().derived.unplacedBoard).toEqual([]);
  expect(engine.snapshot().derived.unplacedSchematic).toEqual(['cmp_a']);
  engine.undo();
  expect(engine.snapshot().derived.unplacedBoard).toEqual(['cmp_a']);
});
test('failed derivations do not publish a half-committed document', () => {
  const module: api.EngineModule = {
    ...demo,
    derive: [
      {
        key: 'unplacedBoard',
        inputs: ['name'],
        schema: z.array(z.string()),
        initial: [],
        run(doc: DeepReadonly<BoardDoc>) {
          if (doc.name === 'Bad') throw new Error('derive');
          return [];
        },
      },
    ],
  };
  const { engine, host } = setup({ modules: [module] });
  const before = engine.snapshot();
  expect(engine.execute('demo.rename', { name: 'Bad' })).toMatchObject({
    ok: false,
    error: { code: 'internal' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
  expect(engine.undo().ok).toBe(false);
});
test('unknown commands and revision overflow do not modify the document', () => {
  const doc = newBoardDoc('Plaat');
  doc.rev = Number.MAX_SAFE_INTEGER;
  const { engine, host } = setup({ doc });
  const before = engine.snapshot();
  expect(engine.execute('missing.command' as CommandId, {} as never)).toMatchObject({
    ok: false,
    error: { code: 'not_found' },
  });
  expect(engine.execute('demo.rename', { name: 'Too late' })).toMatchObject({
    ok: false,
    error: { code: 'internal' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});
