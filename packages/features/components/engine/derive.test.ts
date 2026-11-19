import { newBoardDoc, type Component } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../../engine';

test('unplaced_keys_come_from_components_module', () => {
  const doc = newBoardDoc('Paigutuse proov');
  const bothMissing: Component = {
    id: 'cmp_neither',
    ref: 'U1',
    kind: 'ic',
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: [],
  };
  doc.components.push(
    bothMissing,
    {
      ...bothMissing,
      id: 'cmp_board',
      ref: 'U2',
      board: {
        footprint: 'area',
        params: {},
        center: { x: 50, y: 50 },
        rotationDeg: 0,
        side: 'top',
        scaleX: 1,
        scaleY: 1,
        customPads: {},
      },
    },
    {
      ...bothMissing,
      id: 'cmp_schema',
      ref: 'U3',
      schematic: { symbol: 'box', at: { x: 30, y: 20 }, rot: 0, mirror: false },
    },
  );
  const clock = { now: () => '2026-11-19T10:00:00Z' };
  const without = createEngine({
    modules: engineFeatures.filter(({ id }) => id === 'project' || id === 'photo'),
    reserved: [...RESERVED_FIELDS, 'components', 'measurements'],
    clock,
  });
  without.host.load('without-components', doc, false);
  expect(without.engine.snapshot().derived).not.toHaveProperty('unplacedBoard');
  expect(without.engine.snapshot().derived).not.toHaveProperty('unplacedSchematic');

  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock,
  });
  expect(engine.snapshot().derived.unplacedBoard).toEqual([]);
  expect(engine.snapshot().derived.unplacedSchematic).toEqual([]);
  host.load('with-components', doc, false);
  const before = engine.snapshot();
  expect(before.derived.unplacedBoard).toEqual(['cmp_neither', 'cmp_schema']);
  expect(before.derived.unplacedSchematic).toEqual(['cmp_neither', 'cmp_board']);
  expect(
    engine.execute('photo.setScale', { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, mm: 20 }).ok,
  ).toBe(true);
  const after = engine.snapshot();
  expect(after.doc.scale.pxPerMm).toBe(5);
  expect(after.doc.components).toBe(before.doc.components);
  expect(after.derived.unplacedBoard).toBe(before.derived.unplacedBoard);
  expect(after.derived.unplacedSchematic).toBe(before.derived.unplacedSchematic);
});
