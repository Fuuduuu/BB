import { expect, test } from 'vitest';
import * as api from './index';
import { mutationModule, setup } from './__tests__/helpers';

test('a missing command target rolls back draft changes and buffered events', () => {
  expect(api.CommandTargetNotFound).toBeTypeOf('function');
  const module = mutationModule(() => undefined, ['name']);
  module.commands![0]!.run = (doc, _params, ctx) => {
    doc.name = 'Partial';
    ctx.emit({ type: 'test.partial', payload: { id: 'cmp_absent' } });
    throw new api.CommandTargetNotFound('cmp_absent');
  };
  const { engine, host } = setup({ modules: [module] });
  const before = engine.snapshot();
  let notices = 0;
  engine.subscribe(() => {
    notices++;
  });
  engine.events(() => {
    notices++;
  });
  expect(engine.execute('test.mutate', {})).toEqual({
    ok: false,
    error: { code: 'not_found', id: 'cmp_absent' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
  expect(engine.undo()).toEqual({ ok: false, error: { code: 'not_found', id: 'undo' } });
  expect(notices).toBe(0);
});
