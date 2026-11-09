import { expect, test } from 'vitest';
import { setup } from '../__tests__/helpers';

test('rename project trims the name', () => {
  const { engine } = setup();
  expect(engine.execute('project.rename', { name: '  Toiteplokk õäöü  ' })).toEqual({
    ok: true,
    value: { rev: 1 },
  });
  expect(engine.snapshot().doc.name).toBe('Toiteplokk õäöü');
  engine.undo();
  expect(engine.snapshot().doc.name).toBe('Plaat');
});
test.each(['', ' \t\n ', 'x'.repeat(121)])(
  'rename rejects invalid name %# without a version',
  (name) => {
    const { engine, host } = setup();
    const before = engine.snapshot();
    expect(engine.execute('project.rename', { name })).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    });
    expect(engine.snapshot()).toBe(before);
    expect(host.drainJournal()).toEqual([]);
  },
);
test('rename accepts a 120-character name after trimming', () => {
  const { engine } = setup();
  expect(engine.execute('project.rename', { name: ` ${'x'.repeat(120)} ` }).ok).toBe(true);
  expect(engine.snapshot().doc.name).toHaveLength(120);
});
test('setInfo updates supplied fields and supports explicit empty strings', () => {
  const { engine } = setup();
  engine.execute('project.setInfo', { device: 'PSU-1' });
  engine.execute('project.setInfo', { problem: 'Ei käivitu' });
  expect(engine.snapshot().doc).toMatchObject({ device: 'PSU-1', problem: 'Ei käivitu' });
  engine.execute('project.setInfo', { device: '' });
  expect(engine.snapshot().doc).toMatchObject({ device: '', problem: 'Ei käivitu' });
});
test('empty setInfo preserves revision, history, journal and subscribers', () => {
  const { engine, host } = setup();
  engine.execute('project.setInfo', { device: 'PSU-1' });
  const before = engine.snapshot();
  const journal = host.drainJournal();
  host.requeueJournal(journal);
  let notices = 0;
  engine.subscribe(() => {
    notices++;
  });
  expect(engine.execute('project.setInfo', { device: undefined })).toEqual({
    ok: true,
    value: { rev: 1 },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual(journal);
  expect(notices).toBe(0);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.device).toBeUndefined();
});
test('project commands reject extra fields instead of altering another feature', () => {
  const { engine } = setup();
  const before = engine.snapshot();
  expect(engine.execute('project.setInfo', { components: [] } as never)).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
});
