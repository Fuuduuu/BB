import { expect, test } from 'vitest';
import { createEngine } from '../../../engine/src';
import { engineFeatures, RESERVED_FIELDS } from '../../../features/engine';
import { newBoardDoc } from '../doc';
import type { Connection } from '../model/connection';
import type { Vec2 } from '../model/primitives';

function branchFixture(kind: NonNullable<Connection['board']>['kind']) {
  const doc = newBoardDoc('Raja harupunkti katse');
  for (const { id, ref, center } of [
    { id: 'cmp_target', ref: 'TP1', center: { x: 0, y: 0 } },
    { id: 'cmp_branch', ref: 'TP2', center: { x: 50, y: 100 } },
  ]) {
    doc.components.push({
      id,
      ref,
      kind: 'testpoint',
      marking: '',
      value: '',
      identified: true,
      dnp: false,
      note: '',
      pins: [{ id: '1', uid: `pin_${id}`, nc: false }],
      board: {
        footprint: 'point',
        params: { type: 'tp', shape: 'ümar', size: 1.6, D: 3.2 },
        center,
        rotationDeg: 0,
        side: 'top',
        scaleX: 1,
        scaleY: 1,
        customPads: {},
      },
    });
  }
  doc.junctions.push({ id: 'jun_end', board: { at: { x: 100, y: 0 }, layer: 'top' } });
  const board = { kind, layer: 'top', widthMm: 0.4, waypoints: [] } as const;
  doc.connections.push({
    id: 'con_target',
    a: { pin: { c: 'cmp_target', p: '1' } },
    b: { junction: 'jun_end' },
    basis: 'visual',
    board: { ...board, waypoints: [] },
  });
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-21T10:00:00.000Z' },
  });
  host.load('branch-point', doc, false);
  return {
    engine,
    branch(at: Vec2) {
      return engine.execute('connections.branch', {
        target: 'con_target',
        segment: 0,
        at,
        junctionId: 'jun_branch',
        splitId: 'con_split',
        trace: {
          id: 'con_branch',
          a: { pin: { c: 'cmp_branch', p: '1' } },
          b: { junction: 'jun_branch' },
          board: { ...board, waypoints: [] },
        },
      });
    },
  };
}

test('branch_rejects_point_off_trace', () => {
  const offTrace = branchFixture('trace');
  const before = offTrace.engine.snapshot();
  expect.soft(offTrace.branch({ x: 500, y: 500 })).toEqual({
    ok: false,
    error: {
      code: 'validation',
      issues: [{ code: 'custom', path: [], message: 'branch_point_off_trace' }],
    },
  });
  expect.soft(offTrace.engine.snapshot() === before).toBe(true);

  for (const [kind, at] of [
    ['trace', { x: 50, y: 0 }],
    ['wire', { x: 50, y: 15 }],
  ] as const) {
    const { engine, branch } = branchFixture(kind);
    expect(branch(at).ok).toBe(true);
    expect(engine.snapshot().doc.junctions).toContainEqual({
      id: 'jun_branch',
      board: { at, layer: 'top' },
    });
  }
});
