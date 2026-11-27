import { newBoardDoc } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { setup } from '../../__tests__/helpers';

test('add_and_translate_on_schematic_snap_to_grid', () => {
  const doc = newBoardDoc('Sünteetiline skeemi paigutus');
  const unavailable = { identified: false, dnp: false, marking: '', value: '', note: '', pins: [] };
  doc.components.push(
    { ...unavailable, id: 'cmp_via', ref: 'V1', kind: 'via' },
    { ...unavailable, id: 'cmp_hole', ref: 'H1', kind: 'hole' },
    { ...unavailable, id: 'cmp_unplaced', ref: 'X1', kind: 'other' },
  );
  const { engine } = setup(doc);
  const schematic = { at: { x: 12.3, y: 7.1 }, rot: 0, mirror: false } as const;
  const pins = (id: string) => ['1', '2'].map((pin) => ({ id: pin, uid: `pin_${id}_${pin}` }));
  const add = {
    id: 'cmp_schematic',
    kind: 'resistor',
    pins: pins('schematic'),
    schematic,
  } as const;

  const firstResult = engine.execute('components.add', add);
  expect(firstResult.ok, JSON.stringify(firstResult)).toBe(true);
  const added = engine.snapshot();
  const onlySchematic = added.doc.components.find(({ id }) => id === add.id)!;
  expect(onlySchematic.board).toBeUndefined();
  expect(onlySchematic.schematic).toEqual({
    ...schematic,
    symbol: 'resistor',
    at: { x: 12.7, y: 7.62 },
  });
  expect(added.derived.unplacedBoard).toContain(add.id);
  expect(added.derived.unplacedSchematic).toEqual(['cmp_unplaced']);

  expect(
    engine.execute('components.add', {
      id: 'cmp_invalid_via',
      kind: 'via',
      pins: [],
      schematic,
    }),
  ).toMatchObject({ ok: false, error: { code: 'validation', issues: [{ message: 'no_symbol' }] } });
  expect(engine.snapshot()).toBe(added);

  const dual = { kind: 'component', id: 'cmp_both' } as const;
  expect(
    engine.execute('components.add', {
      ...add,
      id: dual.id,
      pins: pins('both'),
      board: { footprint: 'area', params: {}, center: { x: 85, y: 70 } },
    }).ok,
  ).toBe(true);
  const both = () => engine.snapshot().doc.components.find(({ id }) => id === dual.id)!;
  const original = both();

  expect(
    engine.execute('items.translate', { items: [dual], view: 'schematic', dx: 3, dy: -3 }).ok,
  ).toBe(true);
  const movedSchematic = both();
  expect(movedSchematic.schematic?.at).toEqual({ x: 15.24, y: 5.08 });
  expect(movedSchematic.board?.center).toEqual(original.board?.center);

  expect(engine.execute('items.translate', { items: [dual], dx: 3, dy: -3 }).ok).toBe(true);
  expect(both().board?.center).toEqual({ x: 88, y: 67 });
  expect(both().schematic).toEqual(movedSchematic.schematic);

  const beforeRejected = engine.snapshot();
  expect(
    engine.execute('items.translate', {
      items: [dual, { kind: 'component', id: 'cmp_unplaced' }],
      view: 'schematic',
      dx: 2.54,
      dy: 0,
    }),
  ).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'component_not_on_schematic' }] },
  });
  expect(engine.snapshot()).toBe(beforeRejected);
});
