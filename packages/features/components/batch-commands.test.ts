import { newBoardDoc, type BoardDoc } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { setup } from '../__tests__/helpers';

const placed = 'cmp_placed';
const unplaced = 'cmp_unplaced';
const missing = 'cmp_missing';

function fixture(): BoardDoc {
  const doc = newBoardDoc('Sünteetiline plaat');
  doc.scale.pxPerMm = 12.5;
  doc.components.push({
    id: placed,
    ref: 'R1',
    kind: 'resistor',
    identified: true,
    dnp: true,
    marking: '103',
    value: '10k',
    note: 'Ei kandu koopiale',
    referenceImageId: 'pho_reference',
    schematic: { symbol: 'resistor', at: { x: 10, y: 20 }, rot: 0, mirror: false },
    pins: [
      { id: '1', uid: 'pin_1', name: 'VIN', nc: false },
      { id: '2', uid: 'pin_2', nc: true },
    ],
    board: {
      footprint: 'chip',
      params: { size: '0805' },
      center: { x: 100, y: 80 },
      rotationDeg: 25,
      side: 'top',
      scaleX: 1.2,
      scaleY: 0.9,
      customPads: { '1': { local: { x: 1, y: 2 }, sizeMm: 1, shape: 'circle', through: false } },
      padMap: { '1': '2', '2': '1' },
      labelOffset: { x: -18, y: 27 },
    },
  });
  doc.components.push({
    ...doc.components[0]!,
    id: unplaced,
    ref: 'R2',
    pins: [{ id: '1', uid: 'pin_unplaced', nc: false }],
    board: undefined,
  });
  return doc;
}

test.each(['components.rotate', 'components.flipSide', 'components.removeFromBoard'] as const)(
  '%s handles repeated IDs once and rolls back when a later target fails',
  (command) => {
    const { engine, host } = setup(fixture());
    const before = engine.snapshot();
    const params = (ids: string[]) => ({
      ids,
      ...(command === 'components.rotate' ? { deltaDeg: 90 } : {}),
    });
    expect(engine.execute(command, params([placed, missing]))).toEqual({
      ok: false,
      error: { code: 'not_found', id: missing },
    });
    expect(engine.snapshot()).toBe(before);
    if (command !== 'components.removeFromBoard') {
      expect(engine.execute(command, params([placed, unplaced]))).toMatchObject({
        ok: false,
        error: { code: 'validation', issues: [{ message: 'component_not_placed' }] },
      });
      expect(engine.snapshot()).toBe(before);
    }
    expect(host.drainJournal()).toEqual([]);

    const ids =
      command === 'components.removeFromBoard' ? [placed, unplaced, placed] : [placed, placed];
    expect(engine.execute(command, params(ids))).toEqual({
      ok: true,
      value: { rev: before.rev + 1 },
    });
    const after = engine.snapshot().doc.components[0]!;
    if (command === 'components.rotate') expect(after.board?.rotationDeg).toBe(115);
    else if (command === 'components.flipSide') expect(after.board?.side).toBe('bottom');
    else expect(after.board).toBeUndefined();
    expect(engine.snapshot().doc.components[1]).toBe(before.doc.components[1]);
    expect(host.drainJournal()).toMatchObject([{ commandId: command }]);
    expect(engine.undo().ok).toBe(true);
    expect(engine.snapshot().doc.components).toEqual(before.doc.components);
  },
);

const placedCopy = {
  sourceId: placed,
  id: 'cmp_copy',
  pinUids: { '1': 'pin_copy_1', '2': 'pin_copy_2' },
};

test('duplicate rolls back earlier copies when a later source or pin UID is missing', () => {
  const { engine, host } = setup(fixture());
  const before = engine.snapshot();
  expect(
    engine.execute('components.duplicate', {
      items: [placedCopy, { sourceId: missing, id: 'cmp_invalid', pinUids: {} }],
    }),
  ).toEqual({ ok: false, error: { code: 'not_found', id: missing } });
  expect(engine.snapshot()).toBe(before);
  expect(
    engine.execute('components.duplicate', {
      items: [placedCopy, { sourceId: unplaced, id: 'cmp_invalid', pinUids: {} }],
    }),
  ).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'missing_pin_uid' }] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('duplicate deep-copies placed board data and leaves an unplaced source unplaced', () => {
  const { engine } = setup(fixture());
  const before = engine.snapshot().doc.components;
  expect(
    engine.execute('components.duplicate', {
      items: [
        placedCopy,
        { sourceId: unplaced, id: 'cmp_unplaced_copy', pinUids: { '1': 'pin_copy_3' } },
      ],
    }).ok,
  ).toBe(true);
  const [source, , copy, unplacedCopy] = engine.snapshot().doc.components;
  expect(source).toBe(before[0]);
  expect(copy).toEqual({
    id: 'cmp_copy',
    ref: 'R3',
    kind: 'resistor',
    value: '10k',
    marking: '103',
    identified: true,
    note: '',
    dnp: false,
    pins: [
      { id: '1', uid: 'pin_copy_1', name: 'VIN', nc: false },
      { id: '2', uid: 'pin_copy_2', nc: true },
    ],
    board: { ...source?.board, center: { x: 125, y: 105 } },
  });
  for (const key of ['params', 'center', 'labelOffset', 'customPads', 'padMap'] as const) {
    expect(copy?.board?.[key]).not.toBe(source?.board?.[key]);
  }
  expect(copy?.board?.customPads['1']?.local).not.toBe(source?.board?.customPads['1']?.local);
  expect(unplacedCopy).toMatchObject({
    id: 'cmp_unplaced_copy',
    ref: 'R4',
    pins: [{ id: '1', uid: 'pin_copy_3', nc: false }],
  });
  expect(unplacedCopy?.board).toBeUndefined();
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(before);
});
