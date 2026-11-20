import type { DocumentEngine, DomainEvent } from '@pcbk/contracts';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, Component, NetLabel } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { setup } from '../__tests__/helpers';

function junctionFixture(doc: BoardDoc): NetLabel {
  doc.junctions.push({ id: 'jun_a' }, { id: 'jun_b' });
  doc.connections.push({
    id: 'con_test',
    a: { junction: 'jun_a' },
    b: { junction: 'jun_b' },
    basis: 'assumed',
  });
  return { id: 'lbl_test', anchor: { junction: 'jun_a' }, name: 'VBUS', source: 'user' };
}

function componentFixture(doc: BoardDoc, pinCount: number): NetLabel {
  const part: Component = {
    id: 'cmp_test',
    ref: 'U1',
    kind: 'ic',
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: Array.from({ length: pinCount }, (_, index) => ({
      id: String(index + 1),
      uid: `pin_test_${index + 1}`,
      nc: false,
    })),
  };
  if (pinCount === 14) {
    part.board = {
      footprint: 'soic',
      params: { pins: 14 },
      center: { x: 80, y: 70 },
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    };
  }
  doc.components.push(part);
  return {
    id: 'lbl_test',
    anchor: { pin: { c: part.id, p: String(pinCount) } },
    name: 'VBUS',
    source: 'user',
  };
}

test.each([
  {
    id: 'connections.remove',
    fixture: junctionFixture,
    remove: (engine: DocumentEngine) => engine.execute('connections.remove', { ids: ['con_test'] }),
  },
  {
    id: 'junctions.remove',
    fixture: junctionFixture,
    remove: (engine: DocumentEngine) => engine.execute('junctions.remove', { ids: ['jun_a'] }),
  },
  {
    id: 'components.removePin',
    fixture: (doc: BoardDoc) => componentFixture(doc, 2),
    remove: (engine: DocumentEngine) =>
      engine.execute('components.removePin', { id: 'cmp_test', pinId: '2' }),
  },
  {
    id: 'components.changeFootprint',
    fixture: (doc: BoardDoc) => componentFixture(doc, 14),
    remove: (engine: DocumentEngine) =>
      engine.execute('components.changeFootprint', {
        id: 'cmp_test',
        footprint: 'soic',
        params: { pins: 8 },
        newPinUids: {},
      }),
  },
])('$id emits one rules report for the removed label', ({ fixture, remove }) => {
  const doc = newBoardDoc('Rule event test');
  const label = fixture(doc);
  doc.netLabels.push(label);
  const { engine } = setup(doc);
  const events: DomainEvent[] = [];
  engine.events((event) => events.push(event));

  expect(remove(engine).ok).toBe(true);
  expect(engine.snapshot().doc.netLabels).toEqual([]);
  expect(events).toMatchObject([{ type: 'rules.report', payload: { removedLabels: [label] } }]);

  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.netLabels).toEqual([label]);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.netLabels).toEqual([]);
  expect(events).toHaveLength(1);
});
