import { expect, test } from 'vitest';
import type { Snapshot } from '../../../contracts/src';
import { createEngine } from '../../../engine/src';
import { engineFeatures, RESERVED_FIELDS } from '../../../features/engine';
import { newBoardDoc } from '../doc';
import { boardPads } from '../geometry/board';
import type { BoardDoc } from '../model/board';
import type { Component } from '../model/component';
import type { Connection } from '../model/connection';
import type { EndRef, Layer } from '../model/primitives';
import { deleteItems } from './items';
import { endAcceptsDrawing } from './layers';
import { endKey } from './nets';

const pin = (c: string, p = '1'): EndRef => ({ pin: { c, p } });
const junction = (id: string): EndRef => ({ junction: id });

function component(id: string, ref: string, count = 1): Component {
  return {
    id,
    ref,
    kind: 'ic',
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: Array.from({ length: count }, (_, index) => ({
      id: String(index + 1),
      uid: `pin_${id}_${index + 1}`,
      nc: false,
    })),
  };
}

function connection(id: string, a: EndRef, b: EndRef): Connection {
  return { id, a, b, basis: 'assumed' };
}

function setup(doc: BoardDoc) {
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-19T10:00:00.000Z' },
  });
  host.load('connections-rules', doc, false);
  return engine;
}

function placedDoc() {
  const doc = newBoardDoc('Connected part');
  const part = component('cmp_source', 'U1', 14);
  part.board = {
    footprint: 'soic',
    params: { pins: 14 },
    center: { x: 200, y: 130 },
    rotationDeg: 35,
    side: 'bottom',
    scaleX: 1.5,
    scaleY: 0.75,
    customPads: {},
  };
  part.schematic = { symbol: 'ic', at: { x: 4, y: 7 }, rot: 0, mirror: false };
  doc.components.push(part, component('cmp_ref', 'U2'), component('cmp_other', 'U3'));
  return { doc, part, board: part.board };
}

test('delete_component_turns_connection_ends_into_junctions', () => {
  const { doc, part, board } = placedDoc();
  const contact = pin(part.id);
  const usedId = 'jun_cmp_source_1';
  const expectedId = 'jun_cmp_source_1_2';
  const at = boardPads(board, ['1'], doc.scale.pxPerMm)[0]!.at;
  doc.junctions.push({ id: usedId });
  const first = connection('con_first', contact, pin('cmp_ref'));
  first.board = { kind: 'wire', layer: 'top', widthMm: 0.4, waypoints: [{ x: 17, y: 82 }] };
  doc.connections.push(
    first,
    connection('con_second', pin('cmp_other'), contact),
    connection('con_other', junction(usedId), pin('cmp_ref')),
  );
  doc.netLabels.push(
    { id: 'lbl_lost', anchor: contact, name: 'VBUS', source: 'user' },
    { id: 'lbl_other', anchor: pin('cmp_other'), source: 'user' },
  );
  doc.measurements.push({
    id: 'msr_voltage',
    mode: 'voltage',
    at: { c: part.id, p: '1', uid: part.pins[0]!.uid },
    atLabel: 'U1.1',
    value: 3.3,
    power: 'on',
    takenAt: '2026-11-19T10:00:00.000Z',
    source: 'manual',
  });
  const before = structuredClone(doc);
  const report = deleteItems(doc, [part.id, expectedId]);

  expect(doc.junctions).toEqual([
    { id: usedId },
    { id: expectedId, board: { at, layer: 'top' }, schematic: { at: { x: 4, y: 7 } } },
  ]);
  expect(doc.connections).toEqual([
    { ...before.connections[0], a: junction(expectedId) },
    { ...before.connections[1], b: junction(expectedId) },
    before.connections[2],
  ]);
  expect(doc.components).toEqual(before.components.slice(1));
  expect(doc.netLabels).toEqual(before.netLabels.slice(1));
  expect(doc.measurements).toEqual(before.measurements);
  expect(report).toEqual({ removedLabels: [before.netLabels[0]] });

  const removal = placedDoc();
  const ownId = '15';
  removal.part.pins.push({ id: ownId, uid: 'pin_own', nc: false });
  removal.board.customPads[ownId] = {
    local: { x: 1, y: -2 },
    sizeMm: 0.7,
    shape: 'circle',
    through: false,
  };
  removal.doc.connections.push(connection('con_own', pin(removal.part.id, ownId), pin('cmp_ref')));
  const ownAt = boardPads(removal.board, [ownId], removal.doc.scale.pxPerMm)[0]!.at;
  const remove = setup(removal.doc);
  expect(remove.execute('components.removePin', { id: removal.part.id, pinId: ownId }).ok).toBe(
    true,
  );
  const afterRemove = remove.snapshot().doc;
  expect(afterRemove.junctions).toEqual([
    {
      id: 'jun_cmp_source_15',
      board: { at: ownAt, layer: 'bottom' },
      schematic: { at: { x: 4, y: 7 } },
    },
  ]);
  expect(afterRemove.connections[0]?.a).toEqual(junction('jun_cmp_source_15'));
  expect(afterRemove.components[0]?.pins.some(({ id }) => id === ownId)).toBe(false);
  expect(afterRemove.components[0]?.board?.customPads).toEqual({});

  const swap = placedDoc();
  swap.doc.connections.push(connection('con_soic', pin(swap.part.id, '14'), pin('cmp_ref')));
  const oldAt = boardPads(swap.board, ['14'], swap.doc.scale.pxPerMm)[0]!.at;
  const change = setup(swap.doc);
  expect(
    change.execute('components.changeFootprint', {
      id: swap.part.id,
      footprint: 'soic',
      params: { pins: 8 },
      newPinUids: {},
    }).ok,
  ).toBe(true);
  const afterChange = change.snapshot().doc;
  expect(afterChange.components[0]?.pins).toHaveLength(8);
  expect(afterChange.connections[0]?.a).toEqual(junction('jun_cmp_source_14'));
  expect(afterChange.junctions).toEqual([
    {
      id: 'jun_cmp_source_14',
      board: { at: oldAt, layer: 'bottom' },
      schematic: { at: { x: 4, y: 7 } },
    },
  ]);
});

function junctionPath() {
  const doc = newBoardDoc('Junction path');
  doc.components.push(component('cmp_end', 'U1'));
  doc.junctions.push({ id: 'jun_leaf' }, { id: 'jun_middle' });
  doc.connections.push(
    connection('con_leaf', junction('jun_leaf'), junction('jun_middle')),
    connection('con_end', junction('jun_middle'), pin('cmp_end')),
  );
  return doc;
}

test('remove_connection_drops_orphan_junctions', () => {
  for (const command of ['items.delete', 'connections.remove'] as const) {
    const engine = setup(junctionPath());
    expect(engine.execute(command, { ids: ['con_leaf'] }).ok).toBe(true);
    const { connections, junctions } = engine.snapshot().doc;
    expect(connections.map(({ id }) => id)).toEqual(['con_end']);
    expect(junctions).toEqual([{ id: 'jun_middle' }]);
  }

  const engine = setup(junctionPath());
  expect(engine.execute('junctions.remove', { ids: ['jun_middle'] }).ok).toBe(true);
  expect(engine.snapshot().doc.connections).toEqual([]);
  expect(engine.snapshot().doc.junctions).toEqual([]);

  const noOp = setup(junctionPath());
  const before = noOp.snapshot();
  expect(noOp.execute('items.delete', { ids: ['con_unknown', 'jun_unknown'] }).ok).toBe(true);
  expect(noOp.snapshot()).toBe(before);
});

test('orphan_junction_label_moves_or_is_removed', () => {
  const doc = junctionPath();
  doc.components.push(component('cmp_earlier', 'U2'));
  doc.connections.push(connection('con_earlier', junction('jun_middle'), pin('cmp_earlier')));
  doc.junctions.push({ id: 'jun_lost_a' }, { id: 'jun_lost_b' });
  doc.connections.push(connection('con_lost', junction('jun_lost_a'), junction('jun_lost_b')));
  const reanchor = {
    id: 'lbl_keep',
    anchor: junction('jun_leaf'),
    name: 'VBUS',
    source: 'user',
  } as const;
  const remove = {
    id: 'lbl_lost',
    anchor: junction('jun_lost_b'),
    name: 'GND',
    source: 'user',
  } as const;
  doc.netLabels.push(reanchor, remove);
  const mixed = structuredClone(doc);

  const report = deleteItems(doc, ['con_leaf', 'con_lost']);
  expect(doc.junctions).toEqual([{ id: 'jun_middle' }]);
  expect(doc.netLabels).toEqual([{ ...reanchor, anchor: pin('cmp_earlier') }]);
  expect(report).toEqual({ removedLabels: [remove] });

  const mixedReport = deleteItems(mixed, ['cmp_earlier', 'con_leaf', 'con_lost']);
  expect(mixed.junctions).toEqual([{ id: 'jun_middle' }, { id: 'jun_cmp_earlier_1' }]);
  expect(mixed.netLabels).toEqual([{ ...reanchor, anchor: pin('cmp_end') }]);
  expect(mixedReport).toEqual({ removedLabels: [remove] });

  const fallback = newBoardDoc('Junction-only network');
  fallback.junctions.push({ id: 'jun_leaf' }, { id: 'jun_b' }, { id: 'jun_a' });
  fallback.connections.push(
    connection('con_leaf', junction('jun_leaf'), junction('jun_b')),
    connection('con_survive', junction('jun_b'), junction('jun_a')),
  );
  fallback.netLabels.push(reanchor);
  expect(deleteItems(fallback, ['con_leaf'])).toEqual({ removedLabels: [] });
  expect(fallback.netLabels).toEqual([{ ...reanchor, anchor: junction('jun_a') }]);

  const replaced = newBoardDoc('Only replacement junctions survive');
  replaced.components.push(component('cmp_a', 'U1'), component('cmp_b', 'U2'));
  replaced.junctions.push({ id: 'jun_leaf' });
  replaced.connections.push(
    connection('con_leaf', junction('jun_leaf'), pin('cmp_a')),
    connection('con_bridge', pin('cmp_a'), pin('cmp_b')),
  );
  replaced.netLabels.push(reanchor);
  expect(deleteItems(replaced, ['con_leaf', 'cmp_a', 'cmp_b'])).toEqual({
    removedLabels: [reanchor],
  });
  expect(replaced.junctions).toEqual([{ id: 'jun_cmp_a_1' }, { id: 'jun_cmp_b_1' }]);
  expect(replaced.netLabels).toEqual([]);
});

test('branch_on_trace_creates_junction_and_splits_in_one_step', () => {
  const { doc, part } = placedDoc();
  const from = pin(part.id, '1');
  const to = pin(part.id, '2');
  const branchStart = pin(part.id, '3');
  const waypoints = [
    { x: 120, y: 160 },
    { x: 160, y: 160 },
  ];
  const target: Connection = {
    ...connection('con_target', from, to),
    board: {
      kind: 'trace',
      layer: 'bottom',
      waypoints,
      widthMm: 0.45,
      labelOffset: { x: 3, y: 4 },
    },
  };
  const undrawn = connection('con_undrawn', from, branchStart);
  doc.connections.push(target, undrawn);
  const engine = setup(doc);
  const before = engine.snapshot();
  const junctionId = 'jun_branch';
  const end = junction(junctionId);
  const at = { x: 140, y: 160 };
  const params = {
    target: target.id,
    segment: 1,
    at,
    junctionId,
    splitId: 'con_split',
    trace: {
      id: 'con_branch',
      a: branchStart,
      b: end,
      board: {
        kind: 'trace' as const,
        layer: 'bottom' as const,
        widthMm: 0.3,
        waypoints: [{ x: 140, y: 180 }],
      },
    },
  };

  for (const [change, message] of [
    [{ segment: 3 }, 'invalid_segment'],
    [{ target: undrawn.id }, 'not_drawn'],
    [{ trace: { ...params.trace, b: to } }, 'branch_end_mismatch'],
  ] as const) {
    expect(engine.execute('connections.branch', { ...params, ...change })).toEqual({
      ok: false,
      error: { code: 'validation', issues: [{ code: 'custom', path: [], message }] },
    });
    expect(engine.snapshot()).toBe(before);
  }
  expect(engine.execute('connections.branch', params).ok).toBe(true);
  expect(engine.snapshot().doc.junctions).toEqual([
    { id: junctionId, board: { at, layer: 'bottom' } },
  ]);
  expect(engine.snapshot().doc.connections).toEqual([
    { ...target, b: end, board: { ...target.board, waypoints: [waypoints[0]] } },
    undrawn,
    {
      id: 'con_split',
      a: end,
      b: to,
      basis: 'assumed',
      board: { kind: 'trace', layer: 'bottom', widthMm: 0.45, waypoints: [waypoints[1]] },
    },
    { ...params.trace, basis: 'visual' },
  ]);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc).toEqual({ ...before.doc, rev: before.doc.rev + 2 });
  expect(engine.snapshot().history.canUndo).toBe(false);
});

test('attach_junction_to_pin_moves_labels', () => {
  const { doc, part } = placedDoc();
  const id = 'jun_end';
  const contact = { c: part.id, p: '1' };
  const end = junction(id);
  const drawing = {
    ...connection('con_keep', end, pin(part.id, '2')),
    board: { layer: 'bottom', kind: 'trace', widthMm: 0.6, waypoints: [{ x: 120, y: 70 }] },
  } satisfies Connection;
  const undrawn = connection('con_air', pin(part.id, '3'), end);
  const loop = connection('con_remove', pin(part.id), end);
  const label = { id: 'lbl_move', anchor: end, name: 'VCC', source: 'user' } as const;
  doc.junctions.push({ id, board: { at: { x: 120, y: 70 }, layer: 'bottom' } });
  doc.connections.push(drawing, undrawn, loop);
  doc.netLabels.push(label);

  const wrongLayer = structuredClone(doc);
  wrongLayer.connections[0]!.board!.layer = 'top';
  const rejected = setup(wrongLayer);
  const rejectedBefore = rejected.snapshot();
  expect(rejected.execute('junctions.attachToPin', { id, pin: contact })).toEqual({
    ok: false,
    error: {
      code: 'validation',
      issues: [{ code: 'custom', path: [], message: 'layer_mismatch' }],
    },
  });
  expect(rejected.snapshot()).toBe(rejectedBefore);

  const engine = setup(doc);
  const before = engine.snapshot();
  expect(engine.execute('junctions.attachToPin', { id, pin: { ...contact, p: '99' } })).toEqual({
    ok: false,
    error: { code: 'not_found', id: `${contact.c}:99` },
  });
  expect(engine.execute('junctions.attachToPin', { id: 'jun_missing', pin: contact })).toEqual({
    ok: false,
    error: { code: 'not_found', id: 'jun_missing' },
  });
  expect(engine.execute('junctions.attachToPin', { id, pin: contact }).ok).toBe(true);
  expect(engine.snapshot().doc.connections).toEqual([
    { ...drawing, a: { pin: contact } },
    { ...undrawn, b: { pin: contact } },
  ]);
  expect(engine.snapshot().doc.netLabels).toEqual([{ ...label, anchor: { pin: contact } }]);
  expect(engine.snapshot().doc.junctions).toEqual([]);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc).toEqual({ ...before.doc, rev: before.doc.rev + 2 });
  expect(engine.snapshot().history.canUndo).toBe(false);
});

function terminal(id: string, ref: string, side: Layer, x: number, through = false): Component {
  return {
    ...component(id, ref),
    board: {
      footprint: 'area',
      params: { w: 8, h: 10 },
      center: { x, y: 100 },
      side,
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: { '1': { local: { x: 2, y: 0 }, sizeMm: 1, shape: 'circle', through } },
    },
  };
}

function trace(id: string, a: EndRef, b: EndRef, layer: Layer): Connection {
  return {
    id,
    a,
    b,
    basis: 'visual',
    board: { kind: 'trace', layer, widthMm: 0.3, waypoints: [] },
  };
}

function expectDrawingsOnLayer(doc: Snapshot['doc']) {
  for (const { a, b, board } of doc.connections) {
    if (!board) continue;
    expect(endAcceptsDrawing(doc, a, board.kind, board.layer)).toBe(true);
    expect(endAcceptsDrawing(doc, b, board.kind, board.layer)).toBe(true);
  }
}

test('flip_side_turns_incompatible_trace_ends_into_junctions', () => {
  const doc = newBoardDoc('Side flip');
  const part = terminal('cmp_a', 'U1', 'top', 100);
  const a = pin(part.id);
  const b = pin('cmp_b');
  const c = pin('cmp_c');
  const top = trace('con_top', a, b, 'top');
  const bottom = trace('con_bottom', a, c, 'bottom');
  const at = boardPads(part.board!, ['1'], doc.scale.pxPerMm)[0]!.at;
  const moved = junction('jun_cmp_a_1');
  doc.components.push(
    part,
    terminal('cmp_b', 'U2', 'top', 200),
    terminal('cmp_c', 'U3', 'bottom', 300),
  );
  doc.connections.push(top);
  const throughDoc = structuredClone(doc);
  throughDoc.components[0]!.board!.customPads['1']!.through = true;
  const engine = setup(doc);
  const before = engine.snapshot().doc;

  expect(engine.execute('components.flipSide', { ids: [part.id] }).ok).toBe(true);
  const flipped = engine.snapshot();
  expect(flipped.doc.components[0]?.board?.side).toBe('bottom');
  expect(flipped.doc.connections).toEqual([{ ...top, a: moved }]);
  expect(flipped.doc.junctions).toEqual([{ id: 'jun_cmp_a_1', board: { at, layer: 'top' } }]);
  const flippedNets = flipped.derived.nets!.netOf;
  expect(flippedNets[endKey(a)]).not.toBe(flippedNets[endKey(b)]);
  expectDrawingsOnLayer(flipped.doc);

  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc).toEqual({ ...before, rev: before.rev + 2 });
  expect(engine.snapshot().history.canUndo).toBe(false);
  expect(engine.redo().ok).toBe(true);
  const { basis, ...boardItem } = bottom;
  expect(
    engine.execute('connections.add', { items: [boardItem], basis, skipJoined: false }).ok,
  ).toBe(true);
  const finished = engine.snapshot();
  const nets = finished.derived.nets!.netOf;
  expect(nets[endKey(a)]).toBe(nets[endKey(c)]);
  expect(nets[endKey(b)]).toBe(nets[endKey(moved)]);
  expect(nets[endKey(a)]).not.toBe(nets[endKey(b)]);
  expectDrawingsOnLayer(finished.doc);

  const through = setup(throughDoc);
  expect(through.execute('components.flipSide', { ids: [part.id] }).ok).toBe(true);
  expect(through.snapshot().doc.connections).toEqual([top]);
  expect(through.snapshot().doc.junctions).toEqual([]);
  expectDrawingsOnLayer(through.snapshot().doc);
});

test('lost_through_pin_keeps_layers_joined_by_assumed_connection', () => {
  const doc = newBoardDoc('Through pin');
  const part = terminal('cmp_via', 'U1', 'bottom', 100, true);
  const contact = pin(part.id);
  const top = trace('con_top', contact, pin('cmp_top'), 'top');
  const bottom = trace('con_bottom', pin('cmp_bottom'), contact, 'bottom');
  const air = connection('con_air', contact, pin('cmp_air'));
  doc.components.push(
    part,
    terminal('cmp_top', 'U2', 'top', 200),
    terminal('cmp_bottom', 'U3', 'bottom', 300),
    terminal('cmp_air', 'U4', 'bottom', 400),
  );
  doc.connections.push(top, bottom, air);
  const at = boardPads(part.board!, ['1'], doc.scale.pxPerMm)[0]!.at;
  const junctionBottom = junction('jun_cmp_via_1');
  const junctionTop = junction('jun_cmp_via_1_2');
  const reversed = structuredClone(doc);
  reversed.connections.reverse();
  const engine = setup(doc);
  const peerKeys = [endKey(bottom.a), endKey(top.b), endKey(air.b)];
  const peerMembers = (source: typeof engine) =>
    source
      .snapshot()
      .derived.nets!.list.map(({ members }) => members.filter((key) => peerKeys.includes(key)))
      .filter(({ length }) => length > 0);
  const before = peerMembers(engine);
  expect(before).toHaveLength(1);
  expect(engine.execute('items.delete', { ids: [part.id] }).ok).toBe(true);
  const result = engine.snapshot().doc;
  expect(result.junctions).toHaveLength(2);
  expect(result.junctions).toContainEqual({ id: 'jun_cmp_via_1', board: { at, layer: 'bottom' } });
  expect(result.junctions).toContainEqual({ id: 'jun_cmp_via_1_2', board: { at, layer: 'top' } });
  expect(result.connections).toEqual([
    { ...top, a: junctionTop },
    { ...bottom, b: junctionBottom },
    { ...air, a: junctionBottom },
    connection('con_via_cmp_via_1', junctionBottom, junctionTop),
  ]);
  expect(peerMembers(engine)).toEqual(before);
  expectDrawingsOnLayer(result);

  const reverse = setup(reversed);
  expect(reverse.execute('items.delete', { ids: [part.id] }).ok).toBe(true);
  const compareConnections = (a: Pick<Connection, 'id'>, b: Pick<Connection, 'id'>) =>
    a.id.localeCompare(b.id);
  expect(reverse.snapshot().doc.junctions).toEqual(result.junctions);
  expect([...reverse.snapshot().doc.connections].sort(compareConnections)).toEqual(
    [...result.connections].sort(compareConnections),
  );
  expect(peerMembers(reverse)).toEqual(before);

  const mixed = setup(structuredClone(doc));
  expect(mixed.execute('items.delete', { ids: [part.id, top.id, bottom.id] }).ok).toBe(true);
  expect(mixed.snapshot().doc.connections).toEqual([{ ...air, a: junctionBottom }]);
  expect(mixed.snapshot().doc.junctions).toEqual([
    { id: 'jun_cmp_via_1', board: { at, layer: 'bottom' } },
  ]);
});
