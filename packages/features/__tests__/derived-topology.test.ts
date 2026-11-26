import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, BoardPlacement, Component } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../engine';

const takenAt = '2026-11-26T10:00:00.000Z';
const r1 = 'cmp_r1';
const u1 = 'cmp_u1';
const resistorProbe = { c: r1, p: '2', uid: 'pin_cmp_r1_2' };
const icProbe = { c: u1, p: '3', uid: 'pin_cmp_u1_3' };
const moveResistor = { items: [{ kind: 'component' as const, id: r1 }], dx: 5, dy: -3 };
const renameResistor = { id: r1, ref: 'R5' };
const setUnusedPin = { id: u1, pinId: '8', nc: true };
const link = {
  id: 'con_r1_u1',
  a: { pin: { c: r1, p: '2' } },
  b: { pin: { c: u1, p: '3' } },
};

function placedComponent(
  id: string,
  ref: string,
  kind: Component['kind'],
  pinCount: number,
  placement: Pick<BoardPlacement, 'footprint' | 'params' | 'center'>,
): Component {
  return {
    id,
    ref,
    kind,
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: Array.from({ length: pinCount }, (_, index) => ({
      id: String(index + 1),
      uid: `pin_${id}_${index + 1}`,
      nc: false,
    })),
    board: { ...placement, rotationDeg: 0, side: 'top', scaleX: 1, scaleY: 1, customPads: {} },
  };
}

function board(): BoardDoc {
  const doc = newBoardDoc('Sünteetiline ühenduste plaat');
  doc.components.push(
    placedComponent(r1, 'R1', 'resistor', 2, {
      footprint: 'chip',
      params: { size: '0805' },
      center: { x: 50, y: 50 },
    }),
    placedComponent(u1, 'U1', 'ic', 8, {
      footprint: 'soic',
      params: { pins: 8 },
      center: { x: 150, y: 50 },
    }),
  );
  return doc;
}

function setup(doc: BoardDoc) {
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => takenAt },
  });
  host.load('derived-topology', doc, false);
  return engine;
}

test('nets_and_levels_skip_component_moves', () => {
  const doc = board();
  doc.connections.push({ ...link, basis: 'visual' });
  const engine = setup(doc);
  const before = engine.snapshot().derived;

  expect(engine.execute('items.translate', moveResistor).ok).toBe(true);
  expect(engine.snapshot().derived.nets).toBe(before.nets);
  expect(engine.snapshot().derived.connectionLevels).toBe(before.connectionLevels);

  expect(engine.execute('components.update', renameResistor).ok).toBe(true);
  expect(engine.snapshot().derived.nets).toBe(before.nets);
  expect(engine.snapshot().derived.connectionLevels).toBe(before.connectionLevels);

  expect(engine.execute('components.setNc', setUnusedPin).ok).toBe(true);
  const afterNc = engine.snapshot().derived.nets;
  expect(afterNc).not.toBe(before.nets);

  expect(engine.execute('components.update', { id: r1, kind: 'capacitor' }).ok).toBe(true);
  expect(engine.snapshot().derived.nets).not.toBe(afterNc);
});

test('incremental_derived_equals_full_rebuild', () => {
  const engine = setup(board());
  function expectFullRebuild(result: ReturnType<typeof engine.execute>) {
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const { doc, derived } = engine.snapshot();
    expect(derived).toEqual(setup(structuredClone(doc) as BoardDoc).snapshot().derived);
  }

  expectFullRebuild(
    engine.execute('connections.add', { items: [link], basis: 'visual', skipJoined: false }),
  );
  expectFullRebuild(engine.execute('items.translate', moveResistor));
  expectFullRebuild(engine.execute('components.update', renameResistor));
  expectFullRebuild(engine.execute('components.setNc', setUnusedPin));
  expectFullRebuild(
    engine.execute('beep.record', {
      measurementId: 'msr_r1_u1',
      connectionId: 'con_r1_u1_beep',
      anchor: resistorProbe,
      pin: icProbe,
      beep: true,
      connect: true,
      takenAt,
    }),
  );
  expectFullRebuild(engine.undo());
  expectFullRebuild(engine.undo());
  expectFullRebuild(engine.redo());
});
