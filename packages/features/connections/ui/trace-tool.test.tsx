// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import type { BoardDoc, Vec2 } from '@pcbk/domain';
import { endKey, resolveNets } from '@pcbk/domain/rules';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import {
  mountMeasurements,
  pointer,
  seedRemovablePins,
} from '../../measurements/__tests__/workspace';

const pin = (p: string) => ({ pin: { c: 'cmp_u1', p } });
const left = { x: 70, y: 200 };
const right = { x: 290, y: 200 };
const drawnTrace = {
  id: 'con_horizontal',
  a: { junction: 'jun_left' },
  b: { junction: 'jun_right' },
  basis: 'visual',
  board: { layer: 'top', kind: 'trace', widthMm: 0.4, waypoints: [] },
} as const;

function seedCrossing(doc: BoardDoc) {
  doc.junctions.push(
    { id: 'jun_left', board: { at: left, layer: 'top' } },
    { id: 'jun_right', board: { at: right, layer: 'top' } },
  );
  doc.connections.push({ ...drawnTrace, board: { ...drawnTrace.board, waypoints: [] } });
}

function click(svg: SVGSVGElement, { x, y }: Vec2) {
  pointer(svg, 'pointerdown', x, y);
  pointer(svg, 'pointerup', x, y);
}

const overlay = (svg: SVGSVGElement) => svg.querySelector('[data-trace-preview]');
const target = (svg: SVGSVGElement) => svg.querySelector('[data-trace-target]');

test('crossing_traces_do_not_connect', () => {
  const { engine, host, svg, clickPin } = mountMeasurements({ seed: seedCrossing });
  const before = engine.snapshot().doc;

  fireEvent.keyDown(svg, { key: 't' });
  clickPin('1');
  click(svg, { x: 160, y: 170 });
  click(svg, { x: 160, y: 230 });
  clickPin('2');

  const { doc } = engine.snapshot();
  expect(doc.connections).toEqual([
    ...before.connections,
    {
      id: expect.any(String),
      a: pin('1'),
      b: pin('2'),
      basis: 'visual',
      board: {
        layer: 'top',
        kind: 'trace',
        widthMm: 0.3,
        waypoints: [
          { x: 160, y: 170 },
          { x: 160, y: 230 },
        ],
      },
    },
  ]);
  expect(doc.junctions).toEqual(before.junctions);
  const { netOf } = resolveNets(structuredClone(doc) as BoardDoc);
  expect(netOf.get(endKey(pin('1')))).not.toBe(netOf.get('jun_left'));
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['connections.add']);
  expect(useSessionStore.getState().toolId).toBe('connections.trace');
});

test('trace_end_1px_from_trace_does_not_join', () => {
  const { engine, host, svg, clickPin } = mountMeasurements({ seed: seedCrossing });
  const before = engine.snapshot().doc;
  const outside = { x: 180, y: 197 };

  fireEvent.keyDown(svg, { key: 't' });
  clickPin('1');
  // View zoom updates before the rendered layer geometry catches up.
  act(() => useViewStore.getState().setBoardView({ zoom: 0.1, pan: { x: 0, y: 0 } }));
  pointer(svg, 'pointermove', outside.x, outside.y);
  expect(target(svg)).toBeNull();
  click(svg, outside);
  expect(engine.snapshot().doc).toEqual(before);
  click(svg, { x: 181, y: 197 });

  const { doc } = engine.snapshot();
  const open = doc.junctions.at(-1)!;
  expect(doc.junctions).toEqual([
    ...before.junctions,
    { id: open.id, board: { at: outside, layer: 'top' } },
  ]);
  expect(doc.connections).toEqual([
    ...before.connections,
    {
      id: expect.any(String),
      a: pin('1'),
      b: { junction: open.id },
      basis: 'visual',
      board: { layer: 'top', kind: 'trace', widthMm: 0.3, waypoints: [] },
    },
  ]);
  const { netOf } = resolveNets(structuredClone(doc) as BoardDoc);
  expect(netOf.get(open.id)).not.toBe(netOf.get('jun_left'));
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['connections.add']);
});

test('trace_tool_escape_leaves_no_trace', () => {
  const { engine, host, svg, clickPin, pinPoint } = mountMeasurements();
  const before = engine.snapshot();
  fireEvent.keyDown(svg, { key: 't' });
  expect(screen.getByText('Rada · pealmine')).toBeTruthy();
  fireEvent.keyDown(svg, { key: 'l' });
  expect(screen.getByText('Rada · alumine')).toBeTruthy();
  fireEvent.keyDown(svg, { key: 'l' });
  expect(screen.getByText('Juhe')).toBeTruthy();
  fireEvent.keyDown(svg, { key: 'l' });
  expect(screen.getByText('Rada · pealmine')).toBeTruthy();
  clickPin('1');
  click(svg, { x: 170, y: 150 });
  click(svg, { x: 210, y: 190 });
  fireEvent.keyDown(svg, { key: 'Backspace' });
  fireEvent(
    svg,
    new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 200,
      clientY: 176,
      shiftKey: true,
    }),
  );
  const points = overlay(svg)?.querySelector('polyline')?.getAttribute('points')?.split(' ');
  const { x, y } = pinPoint('1');
  expect(points?.slice(0, 2)).toEqual([`${x},${y}`, '170,150']);
  expect(points).toHaveLength(3);
  const [endX, endY] = points![2]!.split(',').map(Number);
  expect(endX! - 170).toBeCloseTo(endY! - 150);
  expect(overlay(svg)?.textContent).toContain('3,97 mm');
  click(svg, { x: 180, y: 182 });
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(overlay(svg)).toBeNull();
  expect(screen.queryByText('Rada · pealmine')).toBeNull();
  expect(engine.snapshot().doc).toEqual(before.doc);
  expect(host.drainJournal()).toEqual([]);
});

test('a_trace_snap_projects_the_visible_segment_and_undo_restores_the_target', () => {
  const { engine, host, svg, clickPin } = mountMeasurements({ seed: seedCrossing });
  const before = engine.snapshot().doc;
  fireEvent.keyDown(svg, { key: 't' });
  clickPin('1');
  pointer(svg, 'pointermove', 180, 199);
  expect(target(svg)?.tagName).toBe('line');
  click(svg, { x: 180, y: 199 });

  const { doc } = engine.snapshot();
  expect(doc.junctions.at(-1)?.board).toEqual({ at: { x: 180, y: 200 }, layer: 'top' });
  expect(doc.connections).toHaveLength(3);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['connections.branch']);
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
  expect(engine.snapshot().doc.connections).toEqual(before.connections);
  expect(engine.snapshot().doc.junctions).toEqual(before.junctions);
});

test('an_incompatible_pad_ends_a_trace_open_but_a_through_pad_accepts_it', () => {
  const { engine, host, svg, clickPin, pinPoint } = mountMeasurements({
    seed(doc) {
      seedRemovablePins(doc);
      const board = doc.components[0]!.board!;
      board.side = 'bottom';
      board.customPads['2']!.through = false;
    },
  });
  fireEvent.keyDown(svg, { key: 't' });
  clickPin('1');
  const pad = pinPoint('2');
  pointer(svg, 'pointermove', pad.x, pad.y);
  expect(target(svg)).toBeNull();
  clickPin('2');
  expect(engine.snapshot().doc.junctions.at(-1)?.board).toEqual({ at: pad, layer: 'top' });
  expect(engine.snapshot().doc.connections[0]?.b).toEqual({
    junction: engine.snapshot().doc.junctions[0]?.id,
  });

  clickPin('3');
  const through = pinPoint('4');
  pointer(svg, 'pointermove', through.x, through.y);
  expect(target(svg)).not.toBeNull();
  clickPin('4');
  expect(engine.snapshot().doc.connections[1]?.b).toEqual(pin('4'));
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.add',
    'connections.add',
  ]);
});

test('drawing_from_an_air_line_menu_keeps_the_connection_and_uses_its_far_end', () => {
  const { engine, host, svg } = mountMeasurements({
    seed(doc) {
      doc.connections.push({ id: 'con_assumed', a: pin('1'), b: pin('3'), basis: 'assumed' });
    },
  });
  act(() =>
    useSessionStore.getState().setSelection({
      items: [{ kind: 'connection', id: 'con_assumed' }],
    }),
  );
  fireEvent.keyDown(svg, { key: 'F10', shiftKey: true });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Joonista rada fotol' }));
  const bend = { x: 180, y: 145 };
  click(svg, bend);
  click(svg, bend);

  expect(engine.snapshot().doc.connections).toEqual([
    {
      id: 'con_assumed',
      a: pin('1'),
      b: pin('3'),
      basis: 'visual',
      board: { layer: 'top', kind: 'trace', widthMm: 0.3, waypoints: [bend] },
    },
  ]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.drawOnBoard',
  ]);
});

test('drawing_between_reversed_air_line_ends_reuses_the_connection_and_reverses_waypoints', () => {
  const { engine, host, svg, clickPin } = mountMeasurements({
    seed(doc) {
      doc.connections.push({ id: 'con_assumed', a: pin('1'), b: pin('3'), basis: 'assumed' });
    },
  });
  fireEvent.keyDown(svg, { key: 't' });
  clickPin('3');
  const first = { x: 200, y: 155 };
  const second = { x: 160, y: 145 };
  click(svg, first);
  click(svg, second);
  clickPin('1');
  expect(engine.snapshot().doc.connections).toEqual([
    {
      id: 'con_assumed',
      a: pin('1'),
      b: pin('3'),
      basis: 'visual',
      board: { layer: 'top', kind: 'trace', widthMm: 0.3, waypoints: [second, first] },
    },
  ]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.drawOnBoard',
  ]);
});

test('trace_hover_outlines_the_actual_scaled_pad_and_labels_only_the_unfinished_segment', () => {
  const { svg, clickPin, pinPoint } = mountMeasurements({
    seed(doc) {
      doc.components[0]!.board!.scaleX = 2;
    },
  });
  fireEvent.keyDown(svg, { key: 't' });
  clickPin('1');
  const pad = pinPoint('2');
  pointer(svg, 'pointermove', pad.x, pad.y);
  expect(target(svg)?.tagName).toBe('ellipse');
  expect(Number(target(svg)?.getAttribute('rx'))).toBeCloseTo(
    2 * Number(target(svg)?.getAttribute('ry')),
  );
  expect(overlay(svg)?.textContent).toContain('mm');
  click(svg, { x: 180, y: 150 });
  expect(overlay(svg)?.textContent).toBe('');
});

test('trace_start_on_junction_takes_its_layer', () => {
  const left = { x: 80, y: 240 };
  const right = { x: 200, y: 240 };
  const junction = { junction: 'jun_bottom_left' };
  const { engine, svg } = mountMeasurements({
    seed(doc) {
      doc.junctions.push(
        { id: junction.junction, board: { at: left, layer: 'bottom' } },
        { id: 'jun_bottom_right', board: { at: right, layer: 'bottom' } },
      );
      doc.connections.push({
        id: 'con_bottom_wire',
        a: junction,
        b: { junction: 'jun_bottom_right' },
        basis: 'visual',
        board: { kind: 'wire', layer: 'bottom', widthMm: 0.5, waypoints: [] },
      });
    },
  });
  const wire = svg.querySelector('[data-layer="connections.traces"] path[stroke="var(--wire)"]');
  expect.soft(wire?.getAttribute('opacity')).toBe('1');

  fireEvent.keyDown(svg, { key: 't' });
  expect(screen.getByText('Rada · pealmine', { exact: true })).toBeTruthy();
  click(svg, left);
  expect.soft(screen.queryByText('Rada · alumine', { exact: true })).not.toBeNull();
  expect.soft(screen.queryByText(/Ots ei sobi valitud kihiga/)).toBeNull();
  const openEnd = { x: 80, y: 300 };
  click(svg, openEnd);
  click(svg, openEnd);
  expect(engine.snapshot().doc.connections[1]).toMatchObject({
    a: junction,
    board: { kind: 'trace', layer: 'bottom' },
  });

  fireEvent.keyDown(svg, { key: 'Escape' });
  fireEvent.keyDown(svg, { key: 't' });
  fireEvent.keyDown(svg, { key: 'l' });
  fireEvent.keyDown(svg, { key: 'l' });
  click(svg, left);
  expect(screen.getByText('Juhe', { exact: true })).toBeTruthy();
});
