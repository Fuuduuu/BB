import { newBoardDoc } from '@pcbk/domain';
import type { CommandId, Snapshot } from '@pcbk/contracts';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { createEngine } from './index';
import { clock, demo, setup, withTestOwners } from './__tests__/helpers';

test('subscribers synchronously receive authoritative history after every committed action', () => {
  const { engine } = setup();
  const seen: { history: Snapshot['history']; current: Snapshot['history'] }[] = [];
  engine.subscribe((snapshot) => {
    seen.push({ history: snapshot.history, current: engine.snapshot().history });
  });

  expect(engine.snapshot().history).toEqual({ canUndo: false, canRedo: false });
  expect(engine.execute('demo.rename', { name: 'One' }).ok).toBe(true);
  expect(engine.execute('demo.rename', { name: 'Two' }).ok).toBe(true);
  expect(engine.undo().ok).toBe(true);
  expect(engine.undo().ok).toBe(true);
  expect(engine.redo().ok).toBe(true);
  expect(engine.execute('demo.rename', { name: 'Branch' }).ok).toBe(true);

  expect(seen.map((value) => value.history)).toEqual([
    { canUndo: true, canRedo: false },
    { canUndo: true, canRedo: false },
    { canUndo: true, canRedo: true },
    { canUndo: false, canRedo: true },
    { canUndo: true, canRedo: true },
    { canUndo: true, canRedo: false },
  ]);
  for (const value of seen) {
    expect(value.current).toBe(value.history);
    expect(Object.isFrozen(value.history)).toBe(true);
  }
  expect(() => {
    (engine.snapshot().history as { canUndo: boolean }).canUndo = false;
  }).toThrow();
  expect(engine.redo()).toMatchObject({ ok: false, error: { code: 'not_found' } });
});

test('history availability follows the retained 200 steps through undo and redo exhaustion', () => {
  const { engine } = setup();
  for (let index = 0; index < 210; index++) {
    expect(engine.execute('demo.rename', { name: String(index) }).ok).toBe(true);
    expect(engine.snapshot().history).toEqual({ canUndo: true, canRedo: false });
  }
  for (let index = 0; index < 200; index++) {
    expect(engine.undo().ok).toBe(true);
    expect(engine.snapshot().history).toEqual({ canUndo: index < 199, canRedo: true });
  }
  expect(engine.snapshot().doc.name).toBe('9');
  const oldest = engine.snapshot();
  expect(engine.undo().ok).toBe(false);
  expect(engine.snapshot()).toBe(oldest);
  for (let index = 0; index < 200; index++) {
    expect(engine.redo().ok).toBe(true);
    expect(engine.snapshot().history).toEqual({ canUndo: true, canRedo: index < 199 });
  }
  expect(engine.snapshot().doc.name).toBe('209');
  const newest = engine.snapshot();
  expect(engine.redo().ok).toBe(false);
  expect(engine.snapshot()).toBe(newest);
});

test('empty and rejected commands after undo preserve snapshot identity, notifications and redo', () => {
  const { engine, host } = setup();
  engine.execute('demo.rename', { name: 'One' });
  engine.execute('demo.rename', { name: 'Two' });
  engine.undo();
  const before = engine.snapshot();
  host.drainJournal();
  let notices = 0;
  engine.subscribe(() => notices++);
  engine.events(() => notices++);

  expect(before.history).toEqual({ canUndo: true, canRedo: true });
  expect(engine.execute('demo.rename', { name: 'One' })).toEqual({ ok: true, value: { rev: 3 } });
  expect(engine.execute('items.delete', { ids: ['cmp_absent'] }).ok).toBe(true);
  expect(engine.execute('demo.rename', { name: '' }).ok).toBe(false);
  expect(engine.execute('missing.command' as CommandId, {} as never).ok).toBe(false);
  expect(engine.execute('demo.rename', { name: 'Three' }, { requestId: 0 } as never).ok).toBe(
    false,
  );
  expect(engine.snapshot()).toBe(before);
  expect(host.current()!.doc).toBe(before.doc);
  expect(notices).toBe(0);
  expect(host.drainJournal()).toEqual([]);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Two');
  expect(engine.snapshot().history).toEqual({ canUndo: true, canRedo: false });
});

test('initial, loaded and unloaded snapshots reset history availability', () => {
  const { engine, host } = createEngine({ modules: withTestOwners([demo]), clock });
  const empty = engine.snapshot();
  const seen: Snapshot['history'][] = [];
  engine.subscribe((snapshot) => seen.push(snapshot.history));
  expect(empty.history).toEqual({ canUndo: false, canRedo: false });
  host.load('first', newBoardDoc('First'), false);
  engine.execute('demo.rename', { name: 'Changed' });
  host.load('second', newBoardDoc('Second'), false);
  expect(engine.undo().ok).toBe(false);
  expect(engine.redo().ok).toBe(false);
  engine.execute('demo.rename', { name: 'Again' });
  engine.undo();
  host.unload();
  expect(engine.snapshot()).toBe(empty);
  expect(engine.snapshot().history).toEqual({ canUndo: false, canRedo: false });
  expect(seen).toEqual([
    { canUndo: false, canRedo: false },
    { canUndo: true, canRedo: false },
    { canUndo: false, canRedo: false },
    { canUndo: true, canRedo: false },
    { canUndo: false, canRedo: true },
    { canUndo: false, canRedo: false },
  ]);
});

test.each([
  ['command', 'runner'],
  ['command', 'summary'],
  ['command', 'derive'],
  ['command', 'clock'],
  ['undo', 'derive'],
  ['undo', 'clock'],
  ['redo', 'derive'],
  ['redo', 'clock'],
  ['load', 'derive'],
] as const)(
  '%s %s failure preserves both history stacks and the published snapshot',
  (action, stage) => {
    let failing = false;
    const fail = (at: string) => {
      if (failing && stage === at) throw new Error(at);
    };
    const { engine, host } = setup({
      modules: [
        {
          ...demo,
          commands: [
            {
              ...demo.commands![0]!,
              run(doc, params) {
                fail('runner');
                doc.name = params.name;
              },
              summary() {
                fail('summary');
                return 'Rename';
              },
            },
          ],
          derive: [
            {
              key: 'unplacedBoard',
              inputs: ['name'],
              schema: z.array(z.string()),
              initial: [],
              run() {
                fail('derive');
                return [];
              },
            },
          ],
        },
      ],
      clock: {
        now() {
          fail('clock');
          return clock.now();
        },
      },
    });
    engine.execute('demo.rename', { name: 'One' });
    engine.execute('demo.rename', { name: 'Two' });
    engine.undo();
    const before = engine.snapshot();
    host.drainJournal();
    let notices = 0;
    engine.subscribe(() => notices++);
    failing = true;

    expect(before.history).toEqual({ canUndo: true, canRedo: true });
    if (action === 'load') {
      expect(() => host.load('replacement', newBoardDoc('Replacement'), false)).toThrow('derive');
    } else {
      const result =
        action === 'command'
          ? engine.execute('demo.rename', { name: 'Rejected' })
          : engine[action]();
      expect(result).toMatchObject({ ok: false, error: { code: 'validation' } });
    }
    expect(engine.snapshot()).toBe(before);
    expect(host.current()!.doc).toBe(before.doc);
    expect(notices).toBe(0);
    expect(host.drainJournal()).toEqual([]);
    failing = false;
    expect(engine.redo().ok).toBe(true);
    expect(engine.snapshot().doc.name).toBe('Two');
    expect(engine.snapshot().history).toEqual({ canUndo: true, canRedo: false });
    expect(engine.undo().ok).toBe(true);
    expect(engine.undo().ok).toBe(true);
    expect(engine.snapshot().doc.name).toBe('Plaat');
    expect(engine.snapshot().history).toEqual({ canUndo: false, canRedo: true });
    expect(engine.undo().ok).toBe(false);
  },
);
