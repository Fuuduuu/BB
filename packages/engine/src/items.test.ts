import { newBoardDoc } from '@pcbk/domain';
import type { Vec2 } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { component, setup } from './__tests__/helpers';

const first = { kind: 'component', id: 'cmp_a' } as const;
const second = { kind: 'component', id: 'cmp_b' } as const;

function placedComponent(id: string, ref: string, center: Vec2) {
  return {
    ...component(id, ref),
    board: {
      footprint: 'chip',
      params: { size: '0805' },
      center,
      rotationDeg: 90,
      side: 'bottom' as const,
      scaleX: 1,
      scaleY: 1,
      customPads: {},
      labelOffset: { x: 2, y: 3 },
    },
  };
}

test('translate_moves_center_in_one_history_step', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(
    placedComponent(first.id, 'R1', { x: 2, y: 10 }),
    placedComponent(second.id, 'R2', { x: 5, y: 0 }),
    placedComponent('cmp_c', 'R3', { x: 8, y: 8 }),
  );
  const { engine, host } = setup({ doc });
  const original = engine.snapshot().doc.components;

  expect(
    engine.execute('items.translate', { items: [first, second, first], dx: 3, dy: -4 }),
  ).toEqual({
    ok: true,
    value: { rev: 1 },
  });
  const translated = [
    { ...original[0], board: { ...original[0]!.board, center: { x: 5, y: 6 } } },
    { ...original[1], board: { ...original[1]!.board, center: { x: 8, y: -4 } } },
    original[2],
  ];
  expect(engine.snapshot().doc.components).toEqual(translated);
  expect(host.drainJournal()).toEqual([expect.objectContaining({ commandId: 'items.translate' })]);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(original);
  expect(engine.snapshot().history).toEqual({ canUndo: false, canRedo: true });
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(translated);
});

test('undo_restores_exact_center', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(placedComponent(first.id, 'R1', { x: 0.1, y: 0.2 }));
  const { engine } = setup({ doc });

  expect(engine.execute('items.translate', { items: [first], dx: 1e16, dy: -1e16 }).ok).toBe(true);
  expect(engine.snapshot().doc.components[0]?.board?.center).toEqual({ x: 1e16, y: -1e16 });
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]?.board?.center).toEqual({ x: 0.1, y: 0.2 });
});

test('translate_zero_is_noop_without_history_entry', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(placedComponent(first.id, 'R1', { x: -0, y: 3 }));
  const { engine, host } = setup({ doc });
  const before = engine.snapshot();

  expect(engine.execute('items.translate', { items: [first], dx: 0, dy: 0 })).toEqual({
    ok: true,
    value: { rev: before.doc.rev },
  });
  expect(engine.snapshot()).toBe(before);
  expect(engine.snapshot().doc.components[0]?.board?.center.x).toBe(-0);
  expect(host.drainJournal()).toEqual([]);
});

test('translate_rejects_unplaced_component', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(placedComponent(first.id, 'R1', { x: 2, y: 3 }), component(second.id, 'R2'));
  const { engine, host } = setup({ doc });
  const before = engine.snapshot();

  expect(engine.execute('items.translate', { items: [first, second], dx: 1, dy: 2 })).toMatchObject(
    {
      ok: false,
      error: { code: 'validation', issues: [{ message: 'component_not_placed' }] },
    },
  );
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('translate_rejects_missing_component', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(placedComponent(first.id, 'R1', { x: 2, y: 3 }));
  const { engine, host } = setup({ doc });
  const before = engine.snapshot();

  expect(engine.execute('items.translate', { items: [first, second], dx: 1, dy: 2 })).toEqual({
    ok: false,
    error: { code: 'not_found', id: second.id },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test.each([
  { dx: NaN, dy: 0 },
  { dx: Infinity, dy: 0 },
  { dx: 0, dy: -Infinity },
])('translate_rejects_nonfinite_offset ($dx, $dy)', ({ dx, dy }) => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(placedComponent(first.id, 'R1', { x: 2, y: 3 }));
  const { engine, host } = setup({ doc });
  const before = engine.snapshot();

  expect(engine.execute('items.translate', { items: [first], dx, dy })).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('translate_rejects_center_overflow', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(
    placedComponent(first.id, 'R1', { x: 2, y: 3 }),
    placedComponent(second.id, 'R2', { x: Number.MAX_VALUE, y: 0 }),
  );
  const { engine, host } = setup({ doc });
  const before = engine.snapshot();

  expect(
    engine.execute('items.translate', { items: [first, second], dx: Number.MAX_VALUE, dy: 0 }),
  ).toMatchObject({ ok: false, error: { code: 'validation' } });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});
