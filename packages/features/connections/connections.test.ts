// @vitest-environment jsdom
import { act, fireEvent } from '@testing-library/react';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, Connection, EndRef } from '@pcbk/domain';
import * as rules from '@pcbk/domain/rules';
import { expect, test, vi } from 'vitest';
import { setup } from '../__tests__/helpers';
import { mountMeasurements, pointer } from '../measurements/__tests__/workspace';

const { resolveNets } = rules;

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

test('quick_connect_resolves_nets_once', () => {
  const doc = newBoardDoc('Sünteetiline kiirühenduse plaat');
  doc.components = Array.from({ length: 300 }, (_, component) => ({
    id: `cmp_${component}`,
    ref: `U${component + 1}`,
    kind: 'connector',
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: Array.from({ length: 10 }, (_, pin) => ({
      id: String(pin + 1),
      uid: `pin_${component}_${pin}`,
      nc: false,
    })),
  }));
  const pins = doc.components.flatMap(({ id, pins }) =>
    pins.map((pin) => ({ pin: { c: id, p: pin.id } })),
  );
  const selected = pins.slice(0, 64);
  const basis = 'assumed' as const;
  doc.connections = Array.from({ length: 899 }, (_, index) => ({
    id: `con_existing_${index}`,
    a: pins[64 + 2 * index]!,
    b: pins[65 + 2 * index]!,
    basis,
  }));
  doc.connections.push({ id: 'con_prior_path', a: selected[0]!, b: selected[3]!, basis });
  const items = selected.slice(1).map((b, index) => ({
    id: `con_quick_${index}`,
    a: selected[index]!,
    b,
  }));

  const reference = structuredClone(doc);
  for (const item of items) {
    const { netOf } = resolveNets(reference);
    if (netOf.get(rules.endKey(item.a)) !== netOf.get(rules.endKey(item.b))) {
      reference.connections.push({ ...item, basis });
    }
  }
  expect(reference.connections.slice(900).map(({ id }) => id)).toEqual(
    items.filter((_, index) => index !== 2).map(({ id }) => id),
  );
  const { engine } = setup(doc);
  // Count the corresponding graph builds when rerunning the test on the baseline.
  const factory = 'createNetConnectivity' in rules ? 'createNetConnectivity' : 'resolveNets';
  const buildNets = vi.spyOn(rules, factory);
  try {
    const result = engine.execute('connections.add', { items, basis, skipJoined: true });
    expect(result).toMatchObject({ ok: true });
    expect(engine.snapshot().doc.connections).toEqual(reference.connections);
    expect(buildNets).toHaveBeenCalledTimes(1);
  } finally {
    buildNets.mockRestore();
  }
  expect(resolveNets(structuredClone(engine.snapshot().doc) as BoardDoc)).toEqual(
    resolveNets(reference),
  );
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

test('junction_move_keeps_connectivity', () => {
  const original = { x: 220, y: 160 };
  const moved = { x: 250, y: 190 };
  const { engine, host, svg } = mountMeasurements({
    seed(doc) {
      doc.junctions.push(
        { id: 'jun_drawn', board: { at: original, layer: 'top' } },
        { id: 'jun_no_board' },
      );
      doc.connections.push(
        {
          id: 'con_drawn',
          a: { pin: { c: 'cmp_u1', p: '1' } },
          b: { junction: 'jun_drawn' },
          basis: 'visual',
          board: { kind: 'trace', layer: 'top', waypoints: [], widthMm: 0.5 },
        },
        {
          id: 'con_air',
          a: { junction: 'jun_drawn' },
          b: { pin: { c: 'cmp_u1', p: '2' } },
          basis: 'assumed',
        },
        {
          id: 'con_no_board',
          a: { pin: { c: 'cmp_u1', p: '3' } },
          b: { junction: 'jun_no_board' },
          basis: 'assumed',
        },
      );
    },
  });
  const before = engine.snapshot();
  const trace = () =>
    svg.querySelector('[data-layer="connections.traces"] polyline')?.getAttribute('points');
  const air = () => svg.querySelector('[data-layer="connections.airLines"] line');
  const dots = () => svg.querySelector('[data-layer="connections.junctions"] circle');
  const at = (point: typeof original) => `${point.x},${point.y}`;

  expect(trace()).toMatch(new RegExp(` ${at(original)}$`));
  pointer(svg, 'pointerdown', original.x, original.y);
  pointer(svg, 'pointermove', moved.x, moved.y);
  expect(trace()).toMatch(new RegExp(` ${at(moved)}$`));
  expect(air()?.getAttribute('x1')).toBe(String(moved.x));
  expect(air()?.getAttribute('y1')).toBe(String(moved.y));
  expect(dots()?.getAttribute('cx')).toBe(String(moved.x));
  expect(engine.snapshot().doc).toBe(before.doc);
  expect(host.drainJournal()).toEqual([]);
  pointer(svg, 'pointerup', moved.x, moved.y);

  expect(trace()).toMatch(new RegExp(` ${at(moved)}$`));
  const after = engine.snapshot();
  expect(after.doc).toEqual({
    ...before.doc,
    rev: before.doc.rev + 1,
    junctions: [{ id: 'jun_drawn', board: { at: moved, layer: 'top' } }, { id: 'jun_no_board' }],
  });
  expect(resolveNets(structuredClone(after.doc) as BoardDoc)).toEqual(
    resolveNets(structuredClone(before.doc) as BoardDoc),
  );
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['junctions.move']);
  expect(engine.execute('junctions.move', { id: 'jun_no_board', at: moved })).toEqual({
    ok: false,
    error: { code: 'validation', issues: [{ code: 'custom', path: [], message: 'not_on_board' }] },
  });
  expect(engine.snapshot()).toBe(after);
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
  expect(engine.snapshot().doc).toEqual({ ...before.doc, rev: before.doc.rev + 2 });
  expect(engine.snapshot().history.canUndo).toBe(false);
});

test('drawing_edits_reject_an_invalid_index_or_missing_drawing', () => {
  const { engine, host } = mountMeasurements({
    seed(doc) {
      const a = { pin: { c: 'cmp_u1', p: '1' } };
      const b = { pin: { c: 'cmp_u1', p: '2' } };
      doc.connections.push(
        { id: 'con_air', a, b, basis: 'assumed' },
        {
          id: 'con_drawn',
          a,
          b,
          basis: 'visual',
          board: { kind: 'trace', layer: 'top', waypoints: [{ x: 6, y: 4 }], widthMm: 0.3 },
        },
      );
    },
  });
  const before = engine.snapshot();
  const invalid = (message: string) => ({
    ok: false,
    error: { code: 'validation', issues: [{ code: 'custom', path: [], message }] },
  });
  expect(
    engine.execute('connections.insertWaypoint', {
      id: 'con_drawn',
      index: 0.5,
      at: { x: 4, y: 5 },
    }),
  ).toEqual(invalid('invalid_waypoint'));
  expect(engine.execute('connections.removeWaypoint', { id: 'con_drawn', index: 1 })).toEqual(
    invalid('invalid_waypoint'),
  );
  expect(engine.execute('connections.update', { id: 'con_air', waypoints: [] })).toEqual(
    invalid('not_drawn'),
  );
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});
