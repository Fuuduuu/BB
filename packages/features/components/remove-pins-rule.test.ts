import { newBoardDoc, type BoardDoc, type Component } from '@pcbk/domain';
import * as rules from '@pcbk/domain/rules';
import { expect, test, vi } from 'vitest';
import { setup } from '../__tests__/helpers';

const id = 'cmp_soic';
const ownPad = { local: { x: 0.5, y: 1.5 }, sizeMm: 1, shape: 'circle', through: false } as const;

function soic14Fixture(): BoardDoc {
  const doc = newBoardDoc('Sünteetiline SOIC-14');
  doc.components.push({
    id,
    ref: 'U1',
    kind: 'ic',
    marking: 'Sample',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: [
      ...Array.from({ length: 14 }, (_, index) => ({
        id: String(index + 1),
        uid: `pin_${index + 1}`,
        nc: index === 7,
      })),
      { id: 'EP', uid: 'pin_ep', name: 'Exposed', nc: false },
      { id: '15', uid: 'pin_15', name: 'Extra', nc: false },
    ],
    board: {
      footprint: 'soic',
      params: { pins: 14, body: 3.9 },
      center: { x: 16, y: 37 },
      rotationDeg: 30,
      side: 'bottom',
      scaleX: 1.2,
      scaleY: 0.8,
      customPads: { '15': ownPad, EP: ownPad, ghost: ownPad },
      padMap: { '1': '2', '2': '1', '13': '12', alias: '15', orphan: 'ghost' },
    },
  });
  doc.measurements.push({
    id: 'msr_history',
    mode: 'continuity',
    power: 'off',
    beep: true,
    at: { c: id, p: '14', uid: 'pin_14' },
    atLabel: 'U1.14',
    takenAt: '2026-11-19T10:00:00.000Z',
    source: 'manual',
  });
  return doc;
}

test('remove_pin_and_footprint_change_use_remove_pins', () => {
  const removals = vi.spyOn(rules, 'removePins');
  const initial = soic14Fixture();
  const { engine } = setup(initial);
  const before = engine.snapshot();
  const component = initial.components[0]!;
  const board = component.board!;
  const withoutExtra = {
    ...component,
    pins: component.pins.slice(0, -1),
    board: {
      ...board,
      customPads: { EP: ownPad, ghost: ownPad },
      padMap: { '1': '2', '2': '1', '13': '12', orphan: 'ghost' },
    },
  };
  const assertDoc = (rev: number, expected: Component = component) =>
    expect(engine.snapshot().doc).toEqual({ ...initial, rev, components: [expected] });

  expect(engine.execute('components.removePin', { id, pinId: 'ghost' })).toEqual({
    ok: false,
    error: { code: 'not_found', id: `${id}:ghost` },
  });
  expect(engine.execute('components.removePin', { id, pinId: '1' })).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'footprint_pin_locked' }] },
  });
  expect(engine.snapshot()).toBe(before);

  expect(engine.execute('components.removePin', { id, pinId: '15' }).ok).toBe(true);
  assertDoc(1, withoutExtra);
  expect(engine.undo().ok).toBe(true);
  assertDoc(2);

  expect(
    engine.execute('components.changeFootprint', {
      id,
      footprint: 'area',
      params: { w: 12, h: 14 },
      newPinUids: {},
    }).ok,
  ).toBe(true);
  assertDoc(3, { ...component, board: { ...board, footprint: 'area', params: { w: 12, h: 14 } } });
  expect(engine.undo().ok).toBe(true);
  assertDoc(4);

  expect(
    engine.execute('components.changeFootprint', {
      id,
      footprint: 'soic',
      params: { pins: 8 },
      newPinUids: {},
    }).ok,
  ).toBe(true);
  assertDoc(5, {
    ...component,
    pins: [...component.pins.slice(0, 8), ...component.pins.slice(14)],
    board: {
      ...board,
      params: { pins: 8, body: 3.9 },
      customPads: { '15': ownPad, EP: ownPad },
      padMap: { '1': '2', '2': '1' },
    },
  });
  expect(engine.undo().ok).toBe(true);
  assertDoc(6);

  expect(removals.mock.calls.map(([, componentId, ids]) => [componentId, ids])).toEqual([
    [id, ['15']],
    [id, ['9', '10', '11', '12', '13', '14']],
  ]);

  removals.mockRestore();
  const doc = structuredClone(initial);
  rules.removePins(doc, id, ['15', 'ghost']);
  expect(doc).toEqual({ ...initial, components: [withoutExtra] });
});
