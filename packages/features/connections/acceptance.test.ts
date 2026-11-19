import { newBoardDoc } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { validateDocument } from '../../engine/src/invariants';
import { engineFeatures, RESERVED_FIELDS } from '../engine';

test('delete_measured_connected_component_and_undo_stays_consistent', () => {
  const doc = newBoardDoc('Ühendatud komponendi proov');
  const position = { x: 100, y: 110 };
  const pin = { c: 'cmp_source', p: '1' };
  const target = { c: 'cmp_target', p: '1' };
  const component = {
    kind: 'connector' as const,
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
  };
  doc.components.push(
    {
      ...component,
      id: pin.c,
      ref: 'J1',
      pins: [{ id: '1', uid: 'pin_source_1', nc: false }],
      board: {
        footprint: 'area',
        params: { w: 4, h: 4 },
        center: position,
        rotationDeg: 0,
        side: 'top',
        scaleX: 1,
        scaleY: 1,
        customPads: {
          '1': { local: { x: 0, y: 0 }, sizeMm: 1, shape: 'circle', through: true },
        },
      },
    },
    {
      ...component,
      id: target.c,
      ref: 'J2',
      pins: [{ id: '1', uid: 'pin_target_1', nc: false }],
    },
  );
  doc.connections.push({
    id: 'con_source',
    a: { pin },
    b: { pin: target },
    basis: 'visual',
    board: { kind: 'wire', layer: 'bottom', widthMm: 1, waypoints: [] },
  });
  doc.netLabels.push({ id: 'lbl_source', anchor: { pin }, name: 'VIN', source: 'user' });
  doc.measurements.push({
    id: 'msr_source',
    mode: 'voltage',
    at: { ...pin, uid: 'pin_source_1' },
    atLabel: 'J1.1',
    value: 5,
    power: 'on',
    takenAt: '2026-11-19T10:00:00.000Z',
    source: 'manual',
  });

  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-19T10:01:00.000Z' },
  });
  host.load('test', doc, false);
  const before = engine.snapshot().doc;
  expect(validateDocument(before)).toEqual(doc);

  const result = engine.execute('items.delete', { ids: [pin.c] });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  const junction = 'jun_cmp_source_1';
  const deleted = {
    ...before,
    rev: before.rev + 1,
    components: [before.components[1]],
    connections: [{ ...before.connections[0], a: { junction } }],
    junctions: [{ id: junction, board: { at: position, layer: 'bottom' } }],
    netLabels: [],
  };
  const after = engine.snapshot().doc;
  expect(after.connections[0]?.a).toEqual({ junction });
  expect(after).toEqual(deleted);
  expect(validateDocument(after)).toEqual(deleted);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['items.delete']);

  expect(engine.undo().ok).toBe(true);
  expect(validateDocument(engine.snapshot().doc)).toEqual({ ...before, rev: before.rev + 2 });
  expect(engine.redo().ok).toBe(true);
  expect(validateDocument(engine.snapshot().doc)).toEqual({ ...deleted, rev: before.rev + 3 });
});
