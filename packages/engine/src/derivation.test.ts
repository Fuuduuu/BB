import { newBoardDoc } from '@pcbk/domain';
import { PinReadingsSchema } from '@pcbk/domain/measure';
import type { BoardDoc } from '@pcbk/domain';
import type { DeepReadonly, Derived } from '@pcbk/contracts';
import { expect, test, vi } from 'vitest';
import { z } from 'zod';
import { createEngine } from './index';
import { clock, component, demo, mutationModule, setup, withTestOwners } from './__tests__/helpers';

test('derive_reuses_value_when_inputs_unchanged', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(component());
  const run = vi.fn((value: DeepReadonly<BoardDoc>) => value.components.map(({ ref }) => ref));
  const renameComponent = mutationModule(
    (draft) => {
      draft.components[0]!.ref = 'R2';
    },
    ['components'],
  );
  const { engine } = setup({
    doc,
    modules: [
      {
        ...demo,
        derive: [
          {
            key: 'unplacedBoard',
            inputs: ['components'],
            schema: z.array(z.string()),
            initial: [],
            run,
          },
        ],
      },
      renameComponent,
    ],
  });
  const before = engine.snapshot().derived.unplacedBoard;
  expect(run).toHaveBeenCalledTimes(1);
  expect(engine.execute('demo.rename', { name: 'Renamed' }).ok).toBe(true);
  expect(run).toHaveBeenCalledTimes(1);
  expect(engine.snapshot().derived.unplacedBoard).toBe(before);

  expect(engine.execute('test.mutate', {}).ok).toBe(true);
  expect(engine.snapshot().derived.unplacedBoard).toEqual(['R2']);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().derived.unplacedBoard).toEqual(['R1']);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().derived.unplacedBoard).toEqual(['R2']);
  expect(run).toHaveBeenCalledTimes(4);
});

test('derivation initial values are used without running specs and reuse ends on load', () => {
  const run = vi.fn(() => ['computed']);
  const { engine, host } = createEngine({
    clock,
    modules: withTestOwners([
      {
        ...demo,
        derive: [
          {
            key: 'unplacedBoard',
            inputs: [],
            schema: z.array(z.string()),
            initial: ['initial'],
            run,
          },
        ],
      },
    ]),
  });
  const empty = engine.snapshot();
  expect(empty.derived.unplacedBoard).toEqual(['initial']);
  expect(run).not.toHaveBeenCalled();

  const doc = newBoardDoc('Plaat');
  host.load('first', doc, false);
  const first = engine.snapshot().derived.unplacedBoard;
  expect(first).toEqual(['computed']);
  expect(run).toHaveBeenCalledTimes(1);
  host.load('second', doc, false);
  expect(engine.snapshot().derived.unplacedBoard).not.toBe(first);
  expect(run).toHaveBeenCalledTimes(2);
  host.unload();
  expect(engine.snapshot()).toBe(empty);
  expect(run).toHaveBeenCalledTimes(2);
});

test('invalid_pin_readings_does_not_publish_command', () => {
  const { engine, host } = setup({
    modules: [
      {
        ...demo,
        commands: [
          {
            ...demo.commands![0]!,
            run(doc, { name }, ctx) {
              doc.name = name;
              ctx.emit({ type: 'demo.renamed', payload: {} });
            },
          },
        ],
        derive: [
          {
            key: 'pinReadings',
            inputs: ['name'],
            schema: PinReadingsSchema,
            initial: {},
            run(doc): Derived['pinReadings'] {
              if (doc.name !== 'Rejected') return {};
              return {
                pin_a: {
                  measurementId: 'msr_a',
                  mode: 'voltage',
                  value: Infinity,
                  takenAt: clock.now(),
                },
              };
            },
          },
        ],
      },
    ],
  });
  expect(engine.execute('demo.rename', { name: 'Accepted' }).ok).toBe(true);
  expect(engine.undo().ok).toBe(true);
  const before = engine.snapshot();
  host.drainJournal();
  const published = vi.fn();
  const emitted = vi.fn();
  engine.subscribe(published);
  engine.events(emitted);

  expect(engine.execute('demo.rename', { name: 'Rejected' })).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ path: ['pin_a', 'value'] }] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.current()!.doc).toBe(before.doc);
  expect(host.drainJournal()).toEqual([]);
  expect(published).not.toHaveBeenCalled();
  expect(emitted).not.toHaveBeenCalled();
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Accepted');
});
