import { expect, test } from 'vitest';
import { createEngine } from '../../../engine/src';
import { engineFeatures, RESERVED_FIELDS } from '../../../features/engine';
import { newBoardDoc } from '../doc';
import type { Component } from '../model/component';
import type { Connection } from '../model/connection';
import type { EndRef, Side } from '../model/primitives';

function component(id: string, ref: string, side: Side, through: boolean): Component {
  return {
    id,
    ref,
    kind: 'pad',
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: [{ id: '1', uid: `pin_${id}`, nc: false }],
    board: {
      footprint: 'area',
      params: { w: 3, h: 3 },
      center: { x: side === 'top' ? 100 : 200, y: 100 },
      rotationDeg: 0,
      side,
      scaleX: 1,
      scaleY: 1,
      customPads: { '1': { local: { x: 0, y: 0 }, sizeMm: 0.5, shape: 'rect', through } },
    },
  };
}

test('top_trace_joins_bottom_only_through_pad', () => {
  const doc = newBoardDoc('Two board layers');
  doc.components.push(
    component('cmp_top', 'U1', 'top', false),
    component('cmp_bottom', 'U2', 'bottom', false),
    component('cmp_through', 'U3', 'bottom', true),
  );
  const a: EndRef = { pin: { c: 'cmp_top', p: '1' } };
  const surface: EndRef = { pin: { c: 'cmp_bottom', p: '1' } };
  const through: EndRef = { pin: { c: 'cmp_through', p: '1' } };
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-20T10:00:00.000Z' },
  });
  host.load('drawing-layers', doc, false);
  const before = engine.snapshot();
  const trace: NonNullable<Connection['board']> = {
    kind: 'trace',
    layer: 'top',
    widthMm: 0.3,
    waypoints: [],
  };
  const item = { id: 'con_trace', a };
  const common = { basis: 'visual', skipJoined: false } as const;
  expect(
    engine.execute('connections.add', {
      ...common,
      items: [{ ...item, b: surface, board: trace }],
    }),
  ).toEqual({
    ok: false,
    error: {
      code: 'validation',
      issues: [{ code: 'custom', path: [], message: 'layer_mismatch' }],
    },
  });
  expect(engine.snapshot()).toBe(before);
  expect(
    engine.execute('connections.add', { ...common, items: [{ ...item, b: through, board: trace }] })
      .ok,
  ).toBe(true);
  const wire = { ...trace, kind: 'wire' as const, widthMm: 0.5 };
  expect(
    engine.execute('connections.add', {
      ...common,
      items: [{ id: 'con_wire', a, b: surface, board: wire }],
    }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.connections).toEqual([
    { ...item, b: through, basis: 'visual', board: trace },
    { id: 'con_wire', a, b: surface, basis: 'visual', board: wire },
  ]);
});
