import { BoardDocSchema, boardPads, padToBoard } from '@pcbk/domain';
import type { Snapshot } from '@pcbk/contracts';
import { expect, test } from 'vitest';
import { setup } from '../__tests__/helpers';

const id = 'cmp_a';
const numbers = (count: number) => Array.from({ length: count }, (_, index) => String(index + 1));
const soic = { footprint: 'soic', params: { pins: 8 }, center: { x: 20, y: 35 } };
const pinIdentity = { id: '9', uid: 'pin_own' };
const ownPin = { ...pinIdentity, name: 'Thermal' };
const local = { x: 1, y: -2 };
const sizeMm = 0.6;
const ownPad = { local, sizeMm, shape: 'circle', through: false } as const;

function placed(footprint = 'soic') {
  const result = setup();
  expect(
    result.engine.execute('components.add', {
      id,
      kind: 'ic',
      pins: numbers(8).map((number) => ({ id: number, uid: `pin_${number}` })),
      board: { ...soic, footprint, params: footprint === 'area' ? {} : soic.params },
    }).ok,
  ).toBe(true);
  return result;
}

function current(snapshot: Snapshot) {
  return snapshot.doc.components[0]!;
}

function padsByPin(snapshot: Snapshot, pxPerMm = 10) {
  const { board, pins } = current(snapshot);
  return boardPads(
    board!,
    pins.map((pin) => pin.id),
    pxPerMm,
  );
}

function expectMatching(snapshot: Snapshot, expectedIds: readonly string[]) {
  expect(current(snapshot).pins.map((pin) => pin.id)).toEqual(expectedIds);
  expect(
    padsByPin(snapshot)
      .map((pad) => pad.pinId)
      .sort(),
  ).toEqual([...expectedIds].sort());
}

function rejectWith(message: string) {
  return { ok: false, error: { code: 'validation', issues: [{ message }] } };
}

test('placed_footprint_pins_and_pads_stay_matched', () => {
  const { engine, host } = placed();
  const before = engine.snapshot();
  expectMatching(before, numbers(8));

  expect(engine.execute('components.addPin', { id, pin: pinIdentity })).toMatchObject(
    rejectWith('pin_needs_pad'),
  );
  expect(engine.snapshot()).toBe(before);
  expect(engine.execute('components.removePin', { id, pinId: '1' })).toMatchObject(
    rejectWith('footprint_pin_locked'),
  );
  expect(engine.snapshot()).toBe(before);

  expect(engine.execute('components.addOwnPin', { id, pin: ownPin, local, sizeMm }).ok).toBe(true);
  const withOwn = engine.snapshot();
  expectMatching(withOwn, numbers(9));
  expect(engine.execute('components.removeFromBoard', { ids: [id] }).ok).toBe(true);
  const unplaced = engine.snapshot();
  expect(current(unplaced).pins).toEqual(current(withOwn).pins);
  expect(engine.execute('components.placeOnBoard', { id, board: soic })).toMatchObject(
    rejectWith('footprint_pins_mismatch'),
  );
  expect(engine.snapshot()).toBe(unplaced);
  expect(engine.undo().ok).toBe(true);
  expect(current(engine.snapshot())).toEqual(current(withOwn));

  const doc = BoardDocSchema.parse(engine.snapshot().doc);
  doc.components[0]!.board!.padMap = { old: '9' };
  host.load('own-pin-with-legacy-map', doc, false);
  expect(engine.execute('components.removePin', { id, pinId: '9' }).ok).toBe(true);
  expectMatching(engine.snapshot(), numbers(8));
  expect(current(engine.snapshot()).board).toMatchObject({ customPads: {}, padMap: {} });

  expect(engine.execute('components.removeFromBoard', { ids: [id] }).ok).toBe(true);
  expect(engine.execute('components.placeOnBoard', { id, board: soic }).ok).toBe(true);
  expectMatching(engine.snapshot(), numbers(8));

  expect(engine.execute('components.addOwnPin', { id, pin: ownPin, local, sizeMm }).ok).toBe(true);
  expect(
    engine.execute('components.changeFootprint', {
      id,
      footprint: 'dip',
      params: { pins: 8 },
      newPinUids: {},
    }).ok,
  ).toBe(true);
  expectMatching(engine.snapshot(), numbers(9));
  expect(current(engine.snapshot()).board?.customPads).toEqual({ '9': ownPad });
});

test('own_pin_survives_rotate_scale_and_reopen', () => {
  const { engine } = placed();
  expect(engine.execute('components.addOwnPin', { id, pin: ownPin, local, sizeMm }).ok).toBe(true);
  expect(engine.execute('components.rotate', { ids: [id], deltaDeg: 90 }).ok).toBe(true);
  expect(engine.execute('components.setScale', { id, scaleX: 1.5, scaleY: 0.5 }).ok).toBe(true);
  expect(engine.execute('components.flipSide', { ids: [id] }).ok).toBe(true);

  const serialized = JSON.stringify(engine.snapshot().doc);
  const { engine: reopened } = setup(BoardDocSchema.parse(JSON.parse(serialized)));
  const snapshot = reopened.snapshot();
  expect(current(snapshot).pins.at(-1)).toEqual({ ...ownPin, nc: false });
  expect(current(snapshot).board?.customPads).toEqual({ '9': ownPad });
  const custom = padsByPin(snapshot).find((pad) => pad.pinId === '9');
  expect(custom?.at).toEqual(padToBoard(current(snapshot).board!, local, 10));
  expect(custom?.at.x).toBeCloseTo(30);
  expect(custom?.at.y).toBeCloseTo(20);
  expect(custom?.shape).toBe('circle');
});

test('commands add and remove an own pin in single undoable changes on an area', () => {
  const { engine, host } = placed('area');
  const before = engine.snapshot();
  host.drainJournal();
  expect(engine.execute('components.addOwnPin', { id, pin: ownPin, local, sizeMm })).toEqual({
    ok: true,
    value: { rev: before.rev + 1 },
  });
  expect(host.drainJournal()).toMatchObject([{ commandId: 'components.addOwnPin' }]);
  const after = engine.snapshot();
  expect(current(after).board?.customPads).toEqual({ '9': ownPad });
  expect(current(after).pins.at(-1)).toEqual({ ...ownPin, nc: false });
  expect(engine.execute('components.removePin', { id, pinId: '9' }).ok).toBe(true);
  expect(current(engine.snapshot())).toEqual(current(before));
  expect(host.drainJournal()).toMatchObject([{ commandId: 'components.removePin' }]);
  expect(engine.undo().ok).toBe(true);
  expect(current(engine.snapshot())).toEqual(current(after));
  expect(engine.undo().ok).toBe(true);
  expect(current(engine.snapshot())).toEqual(current(before));
  expect(engine.execute('components.addPin', { id, pin: pinIdentity }).ok).toBe(true);
  expect(current(engine.snapshot()).board?.customPads).toEqual({});
});

test.each([
  [{ ...ownPin, id: '1' }, 'duplicate_pin'],
  [{ ...ownPin, uid: 'pin_1' }, 'duplicate_pin_uid'],
])('addOwnPin rejects an already used pin identity %#', (pin, message) => {
  const { engine } = placed();
  const before = engine.snapshot();
  expect(engine.execute('components.addOwnPin', { id, pin, local, sizeMm })).toMatchObject(
    rejectWith(message),
  );
  expect(engine.snapshot()).toBe(before);
});

test('addOwnPin requires a placed component', () => {
  const { engine } = placed();
  expect(engine.execute('components.removeFromBoard', { ids: [id] }).ok).toBe(true);
  const before = engine.snapshot();
  expect(engine.execute('components.addOwnPin', { id, pin: ownPin, local, sizeMm })).toMatchObject(
    rejectWith('component_not_placed'),
  );
  expect(engine.snapshot()).toBe(before);
});

test('addOwnPin cannot claim an existing footprint pad target in a legacy placement', () => {
  const initial = placed();
  const doc = BoardDocSchema.parse(initial.engine.snapshot().doc);
  doc.components[0]!.board!.padMap = { '1': ownPin.id };
  const { engine } = setup(doc);
  const before = engine.snapshot();
  expect(engine.execute('components.addOwnPin', { id, pin: ownPin, local, sizeMm })).toMatchObject(
    rejectWith('duplicate_pin'),
  );
  expect(engine.snapshot()).toBe(before);
});

test.each([0, -1, Number.POSITIVE_INFINITY])(
  'addOwnPin rejects an invalid pad size %s',
  (sizeMm) => {
    const { engine } = placed();
    const before = engine.snapshot();
    expect(
      engine.execute('components.addOwnPin', { id, pin: ownPin, local, sizeMm }),
    ).toMatchObject({ ok: false, error: { code: 'validation', issues: [{ path: ['sizeMm'] }] } });
    expect(engine.snapshot()).toBe(before);
  },
);

test('removePin protects effective footprint pin IDs and clears only links to the removed pin', () => {
  const initial = placed();
  const doc = BoardDocSchema.parse(initial.engine.snapshot().doc);
  const component = doc.components[0]!;
  component.pins.push({ id: 'A', uid: 'pin_a', nc: false });
  component.board!.padMap = { '1': 'A', stale: '1' };
  component.board!.customPads = { '1': ownPad };
  const { engine } = setup(doc);
  const before = engine.snapshot();
  expect(engine.execute('components.removePin', { id, pinId: 'A' })).toMatchObject(
    rejectWith('footprint_pin_locked'),
  );
  expect(engine.snapshot()).toBe(before);
  expect(engine.execute('components.removePin', { id, pinId: '1' }).ok).toBe(true);
  expectMatching(engine.snapshot(), [...numbers(8).slice(1), 'A']);
  expect(current(engine.snapshot()).board?.padMap).toEqual({ '1': 'A' });
  expect(current(engine.snapshot()).board?.customPads).toEqual({});
});

test('removePin cleans legacy pad records on an area too', () => {
  const initial = placed('area');
  const doc = BoardDocSchema.parse(initial.engine.snapshot().doc);
  const board = doc.components[0]!.board!;
  board.padMap = { legacy: '1', another: '2' };
  board.customPads = { '1': ownPad, '2': ownPad };
  const { engine } = setup(doc);
  expect(engine.execute('components.removePin', { id, pinId: '1' }).ok).toBe(true);
  expect(current(engine.snapshot()).board?.padMap).toEqual({ another: '2' });
  expect(current(engine.snapshot()).board?.customPads).toEqual({ '2': ownPad });
});

test('changeFootprint promotes a same-numbered own pin and preserves the order of remaining own pins', () => {
  const initial = placed();
  const doc = BoardDocSchema.parse(initial.engine.snapshot().doc);
  const component = doc.components[0]!;
  component.pins.push(
    { id: 'EP', uid: 'pin_ep', nc: false },
    { ...ownPin, nc: true },
    { id: '10', uid: 'pin_extra', nc: false },
    { id: 'A', uid: 'pin_a', nc: false },
  );
  component.board!.customPads = { EP: ownPad, '9': ownPad, '10': ownPad, A: ownPad };
  const { engine } = setup(doc);
  expect(
    engine.execute('components.changeFootprint', {
      id,
      footprint: 'sop',
      params: { pins: 10 },
      newPinUids: {},
    }).ok,
  ).toBe(true);
  expectMatching(engine.snapshot(), [...numbers(10), 'EP', 'A']);
  expect(current(engine.snapshot()).pins[8]).toEqual({ ...ownPin, nc: true });
  expect(current(engine.snapshot()).board?.customPads).toEqual({ EP: ownPad, A: ownPad });
});
