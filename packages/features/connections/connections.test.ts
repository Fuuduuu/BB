// @vitest-environment jsdom
import { act } from '@testing-library/react';
import type { Connection, EndRef } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { mountMeasurements } from '../measurements/__tests__/workspace';

test('remove_board_drawing_keeps_connection_as_air_line', () => {
  const connection: Connection = {
    id: 'con_drawn',
    a: { pin: { c: 'cmp_u1', p: '1' } },
    b: { pin: { c: 'cmp_u1', p: '4' } },
    basis: 'visual',
    schematic: { waypoints: [{ x: 12, y: 20 }] },
  };
  const { engine, svg } = mountMeasurements({
    seed(doc) {
      doc.connections.push({
        ...connection,
        board: {
          kind: 'trace',
          layer: 'top',
          waypoints: [{ x: 160, y: 130 }],
          widthMm: 0.5,
          labelOffset: { x: 2, y: 3 },
        },
      });
    },
  });
  const selector = '[data-layer="connections.airLines"] line';
  expect(svg.querySelector(selector)).toBeNull();
  act(() => {
    const result = engine.execute('connections.removeBoardDrawing', { ids: ['con_drawn'] });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
  });
  expect(engine.snapshot().doc.connections).toEqual([connection]);
  expect(svg.querySelector(selector)?.getAttribute('stroke-dasharray')).toBe('6 4');
});

test('skip_joined_considers_earlier_connections_in_the_same_command', () => {
  const { engine, host } = mountMeasurements();
  const pin = (p: string): EndRef => ({ pin: { c: 'cmp_u1', p } });
  const connection = (id: string, a: string, b: string) => ({ id, a: pin(a), b: pin(b) });
  const first = connection('con_first', '1', '2');
  const second = connection('con_second', '2', '3');
  const transitive = connection('con_transitive', '3', '1');
  const params = { basis: 'assumed', skipJoined: true } as const;

  act(() => {
    expect(
      engine.execute('connections.add', { ...params, items: [first, second, transitive] }).ok,
    ).toBe(true);
  });
  expect(engine.snapshot().doc.connections).toEqual([
    { ...first, basis: 'assumed' },
    { ...second, basis: 'assumed' },
  ]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['connections.add']);

  const before = engine.snapshot();
  const fresh = connection('con_fresh', '1', '4');
  const missing = connection('con_missing', '1', '8');
  expect(engine.execute('connections.add', { ...params, items: [fresh, missing] })).toEqual({
    ok: false,
    error: { code: 'not_found', id: 'cmp_u1:8' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(engine.execute('connections.add', { ...params, items: [transitive] })).toEqual({
    ok: true,
    value: { rev: before.doc.rev },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('removal_commands_reject_a_missing_id_without_changing_document', () => {
  const { engine, host } = mountMeasurements({
    seed(doc) {
      doc.junctions.push({ id: 'jun_shared', board: { at: { x: 150, y: 150 }, layer: 'top' } });
      doc.connections.push({
        id: 'con_drawn',
        a: { pin: { c: 'cmp_u1', p: '1' } },
        b: { junction: 'jun_shared' },
        basis: 'visual',
        board: { kind: 'trace', layer: 'top', waypoints: [], widthMm: 0.5 },
      });
    },
  });
  const before = engine.snapshot();
  const commands = [
    ['connections.remove', 'con_drawn'],
    ['connections.removeBoardDrawing', 'con_drawn'],
    ['junctions.remove', 'jun_shared'],
  ] as const;
  for (const [command, present] of commands) {
    expect(engine.execute(command, { ids: [present, present, 'missing'] })).toEqual({
      ok: false,
      error: { code: 'not_found', id: 'missing' },
    });
    expect(engine.snapshot()).toBe(before);
  }
  expect(host.drainJournal()).toEqual([]);
});

test('trace_on_existing_connection_adds_only_drawing', () => {
  const airLine: Connection = {
    id: 'con_assumed',
    a: { pin: { c: 'cmp_u1', p: '1' } },
    b: { pin: { c: 'cmp_u1', p: '4' } },
    basis: 'assumed',
  };
  const { engine, host } = mountMeasurements({ seed: (doc) => doc.connections.push(airLine) });
  const board: NonNullable<Connection['board']> = {
    kind: 'trace',
    layer: 'top',
    waypoints: [{ x: 160, y: 130 }],
    widthMm: 0.3,
  };
  act(() => {
    const result = engine.execute('connections.drawOnBoard', { id: airLine.id, board });
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
  });
  const drawn = engine.snapshot();
  expect(drawn.doc.connections).toEqual([{ ...airLine, basis: 'visual', board }]);
  expect(drawn.doc.junctions).toEqual([]);
  expect(engine.execute('connections.drawOnBoard', { id: airLine.id, board })).toEqual({
    ok: false,
    error: {
      code: 'validation',
      issues: [{ code: 'custom', path: [], message: 'already_drawn' }],
    },
  });
  expect(engine.snapshot()).toBe(drawn);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.drawOnBoard',
  ]);
});
