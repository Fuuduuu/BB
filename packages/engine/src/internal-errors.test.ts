import { newBoardDoc } from '@pcbk/domain';
import { expect, test, vi } from 'vitest';
import { z } from 'zod';
import * as api from './index';
import { clock, demo, mutationModule, withTestOwners } from './__tests__/helpers';

function failingCommand(error: unknown) {
  const onInternalError = vi.fn();
  const result = api.createEngine({
    modules: withTestOwners([
      mutationModule(() => {
        throw error;
      }),
    ]),
    clock,
    onInternalError,
  });
  result.host.load('session-a', newBoardDoc('Plaat'), false);
  return { ...result, onInternalError };
}

test('programming_error_in_command_is_internal_and_logged', () => {
  const error = new Error('broken runner');
  const { engine, onInternalError } = failingCommand(error);
  expect(engine.execute('test.mutate', {})).toEqual({
    ok: false,
    error: { code: 'internal', message: 'broken runner' },
  });
  expect(onInternalError).toHaveBeenCalledExactlyOnceWith(error, 'test.mutate');
});

test('unknown_thrown_value_is_internal_with_unknown_message', () => {
  const { engine, onInternalError } = failingCommand(undefined);
  expect(engine.execute('test.mutate', {})).toEqual({
    ok: false,
    error: { code: 'internal', message: 'unknown' },
  });
  expect(onInternalError).toHaveBeenCalledExactlyOnceWith(undefined, 'test.mutate');
});

test('throwing_internal_error_logger_cannot_escape_or_replace_command_failure', () => {
  const original = new Error('original failure');
  const onInternalError = vi.fn(() => {
    throw new Error('logging failed');
  });
  const { engine, host } = api.createEngine({
    modules: withTestOwners([
      mutationModule((doc) => {
        doc.name = 'Partial';
        throw original;
      }),
    ]),
    clock,
    onInternalError,
  });
  host.load('session-a', newBoardDoc('Plaat'), false);
  const before = engine.snapshot();
  expect(engine.execute('test.mutate', {})).toEqual({
    ok: false,
    error: { code: 'internal', message: 'original failure' },
  });
  expect(onInternalError).toHaveBeenCalledExactlyOnceWith(original, 'test.mutate');
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
  expect(engine.undo()).toEqual({ ok: false, error: { code: 'not_found', id: 'undo' } });
});

test('rejected_command_stays_validation_with_reason', () => {
  const onInternalError = vi.fn();
  let rejection: unknown;
  const { engine, host } = api.createEngine({
    modules: withTestOwners([
      mutationModule(() => {
        try {
          api.reject('already_placed');
        } catch (error) {
          rejection = error;
          throw error;
        }
      }),
    ]),
    clock,
    onInternalError,
  });
  host.load('session-a', newBoardDoc('Plaat'), false);
  expect(engine.execute('test.mutate', {})).toEqual({
    ok: false,
    error: {
      code: 'validation',
      issues: [{ code: 'custom', path: [], message: 'already_placed' }],
    },
  });
  expect(rejection).toBeInstanceOf(api.CommandRejected);
  expect(rejection).toMatchObject({ reason: 'already_placed' });
  expect(onInternalError).not.toHaveBeenCalled();
});

test('zod_error_in_command_stays_validation', () => {
  const parsed = z.string().safeParse(7);
  if (parsed.success) throw new Error('Expected invalid test input');
  const { engine, onInternalError } = failingCommand(parsed.error);
  expect(engine.execute('test.mutate', {})).toEqual({
    ok: false,
    error: { code: 'validation', issues: parsed.error.issues },
  });
  expect(onInternalError).not.toHaveBeenCalled();
});

test('internal_error_leaves_document_and_history_unchanged', () => {
  const bad = mutationModule((doc) => {
    doc.name = 'Partial';
    throw new Error('runner');
  }, []);
  bad.commands![0]!.alsoWrites = ['name'];
  const { engine, host } = api.createEngine({ modules: withTestOwners([demo, bad]), clock });
  host.load('session-a', newBoardDoc('Plaat'), false);
  engine.execute('demo.rename', { name: 'One' });
  engine.execute('demo.rename', { name: 'Two' });
  engine.undo();
  const before = engine.snapshot();
  host.drainJournal();
  const changed = vi.fn();
  const emitted = vi.fn();
  engine.subscribe(changed);
  engine.events(emitted);
  expect(engine.execute('test.mutate', {})).toEqual({
    ok: false,
    error: { code: 'internal', message: 'runner' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.current()!.doc).toBe(before.doc);
  expect(before.history).toEqual({ canUndo: true, canRedo: true });
  expect(host.drainJournal()).toEqual([]);
  expect(changed).not.toHaveBeenCalled();
  expect(emitted).not.toHaveBeenCalled();
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Two');
  expect(engine.undo().ok).toBe(true);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.name).toBe('Plaat');
});
