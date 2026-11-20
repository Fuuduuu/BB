// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import type { BoardDoc, Vec2 } from '@pcbk/domain';
import { resolveNets } from '@pcbk/domain/rules';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import {
  mountMeasurements,
  pointer,
  seedRemovablePins,
} from '../../measurements/__tests__/workspace';

const pinEnd = (p: string) => ({ pin: { c: 'cmp_u1', p } });
const jointEnd = { junction: 'jun_edit' };
const joint = { x: 300, y: 210 };
const corner = { x: 160, y: 160 };
const secondCorner = { x: 240, y: 190 };

function seedEditableDrawing(doc: BoardDoc) {
  doc.junctions.push({ id: 'jun_edit', board: { at: joint, layer: 'top' } });
  doc.connections.push(
    {
      id: 'con_edit',
      a: pinEnd('1'),
      b: jointEnd,
      basis: 'visual',
      board: { kind: 'trace', layer: 'top', widthMm: 0.3, waypoints: [corner, secondCorner] },
    },
    { id: 'con_air', a: pinEnd('2'), b: jointEnd, basis: 'assumed' },
  );
}

function signal(svg: SVGSVGElement, type: string, { x, y }: Vec2) {
  pointer(svg, type, x, y);
}

function clickPoint(svg: SVGSVGElement, at: Vec2) {
  signal(svg, 'pointerdown', at);
  signal(svg, 'pointerup', at);
}

function beginDrag(svg: SVGSVGElement, from: Vec2, to: Vec2) {
  signal(svg, 'pointerdown', from);
  signal(svg, 'pointermove', to);
}

function tracePoints(svg: SVGSVGElement) {
  return svg
    .querySelector('[data-layer="connections.traces"] polyline')
    ?.getAttribute('points')
    ?.split(' ');
}

const coordinates = ({ x, y }: Vec2) => `${x},${y}`;

test('waypoint_drag_changes_only_drawing_in_one_step', () => {
  const { engine, host, svg, pinPoint } = mountMeasurements({ seed: seedEditableDrawing });
  const before = engine.snapshot().doc;
  clickPoint(svg, { x: 200, y: 175 });
  const selection = { items: [{ kind: 'connection', id: 'con_edit' }] };
  expect(useSessionStore.getState().selection).toEqual(selection);
  const handle = svg.querySelector('[data-waypoint-handle="con_edit:0"]');
  expect(handle?.getAttribute('width')).toBe('6');
  clickPoint(svg, corner);
  expect(useSessionStore.getState().selection).toEqual(selection);

  const moved = { x: 180, y: 172 };
  beginDrag(svg, corner, moved);
  expect(tracePoints(svg)?.[1]).toBe(coordinates(moved));
  expect(engine.snapshot().doc).toBe(before);
  expect(host.drainJournal()).toEqual([]);
  signal(svg, 'pointerup', moved);
  const after = engine.snapshot().doc;
  expect(after.connections).toEqual([
    {
      ...before.connections[0],
      board: { ...before.connections[0]?.board, waypoints: [moved, secondCorner] },
    },
    before.connections[1],
  ]);
  expect(resolveNets(structuredClone(after) as BoardDoc)).toEqual(
    resolveNets(structuredClone(before) as BoardDoc),
  );
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['connections.update']);
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
  expect(engine.snapshot().doc.connections).toEqual(before.connections);
  host.drainJournal();

  beginDrag(svg, corner, moved);
  expect(tracePoints(svg)?.[1]).toBe(coordinates(moved));
  fireEvent.keyDown(svg, { key: 'Escape' });
  signal(svg, 'pointerup', moved);
  expect(tracePoints(svg)?.[1]).toBe(coordinates(corner));
  expect(engine.snapshot().doc.connections).toEqual(before.connections);
  expect(host.drainJournal()).toEqual([]);

  const source = pinPoint('1');
  const air = pinPoint('2');
  beginDrag(svg, { x: 160, y: 100 }, { x: 173, y: 140 });
  expect(tracePoints(svg)?.[0]).toBe(coordinates({ x: source.x + 13, y: source.y + 40 }));
  const airLine = svg.querySelector('[data-layer="connections.airLines"] line');
  expect(Number(airLine?.getAttribute('x1'))).toBeCloseTo(air.x + 13);
  expect(Number(airLine?.getAttribute('y1'))).toBeCloseTo(air.y + 40);
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(engine.snapshot().doc.components).toEqual(before.components);
});

test('junction_drag_attaches_only_to_a_compatible_pad_and_can_be_undone', () => {
  const { engine, host, svg, pinPoint } = mountMeasurements({
    seed(doc) {
      seedEditableDrawing(doc);
      seedRemovablePins(doc);
      const board = doc.components[0]!.board!;
      board.side = 'bottom';
      board.customPads['2']!.through = false;
      doc.netLabels.push({ id: 'lbl_edit', anchor: jointEnd, name: 'VBUS', source: 'user' });
    },
  });
  const before = engine.snapshot().doc;
  const target = () => svg.querySelector('[data-junction-attachment-target]');
  clickPoint(svg, joint);
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'junction', id: 'jun_edit' },
  ]);

  const blocked = pinPoint('2');
  beginDrag(svg, joint, blocked);
  expect(target()).toBeNull();
  signal(svg, 'pointerup', blocked);
  expect(engine.snapshot().doc.connections).toEqual(before.connections);
  expect(engine.snapshot().doc.junctions[0]?.board?.at).toEqual(blocked);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['junctions.move']);
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
  host.drainJournal();

  const allowed = pinPoint('3');
  beginDrag(svg, joint, allowed);
  expect(target()?.getAttribute('stroke')).toBe('var(--sel)');
  const pins = svg.querySelector('[data-layer="components.pins"]');
  expect(pins!.compareDocumentPosition(target()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(engine.snapshot().doc.junctions).toEqual(before.junctions);
  signal(svg, 'pointerup', allowed);
  expect(engine.snapshot().doc.junctions).toEqual([]);
  expect(engine.snapshot().doc.connections.map(({ b }) => b)).toEqual([pinEnd('3'), pinEnd('3')]);
  expect(engine.snapshot().doc.netLabels[0]?.anchor).toEqual(pinEnd('3'));
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['junctions.attachToPin']);
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
  expect(engine.snapshot().doc.connections).toEqual(before.connections);
  expect(engine.snapshot().doc.junctions).toEqual(before.junctions);
  expect(engine.snapshot().doc.netLabels).toEqual(before.netLabels);
});

test('junction_drop_uses_the_rotated_pad_shape_then_pin_order_for_overlaps', () => {
  const { engine, svg } = mountMeasurements({
    seed(doc) {
      seedEditableDrawing(doc);
      seedRemovablePins(doc);
      doc.connections[0]!.a = pinEnd('4');
      const board = doc.components[0]!.board!;
      board.scaleX = 2;
      board.rotationDeg = 90;
      const pad = { local: { x: 0, y: 0 }, sizeMm: 2, through: true };
      board.customPads['1'] = { ...pad, shape: 'circle' };
      board.customPads['2'] = { ...pad, shape: 'rect' };
    },
  });
  const corner = { x: 169, y: 118 };
  beginDrag(svg, joint, corner);
  expect(svg.querySelector('[data-junction-attachment-target]')?.tagName).toBe('rect');
  signal(svg, 'pointerup', corner);
  expect(engine.snapshot().doc.connections[0]?.b).toEqual(pinEnd('2'));
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });

  const center = { x: 160, y: 100 };
  beginDrag(svg, joint, center);
  expect(svg.querySelector('[data-junction-attachment-target]')?.tagName).toBe('ellipse');
  signal(svg, 'pointerup', center);
  expect(engine.snapshot().doc.connections[0]?.b).toEqual(pinEnd('1'));
});

test('insert_and_remove_waypoint', () => {
  const original = [
    { x: 160, y: 200 },
    { x: 240, y: 200 },
  ];
  const inserted = { x: 210, y: 200 };
  const { engine, host, svg } = mountMeasurements({
    seed(doc) {
      doc.junctions.push(
        { id: 'jun_left', board: { at: { x: 120, y: 200 }, layer: 'top' } },
        { id: 'jun_right', board: { at: { x: 320, y: 200 }, layer: 'top' } },
      );
      doc.connections.push({
        id: 'con_main',
        basis: 'visual',
        a: { junction: 'jun_left' },
        b: { junction: 'jun_right' },
        board: { kind: 'trace', layer: 'top', widthMm: 0.4, waypoints: original },
      });
    },
  });
  const waypoints = () => engine.snapshot().doc.connections[0]?.board?.waypoints;
  const open = (clientX: number, clientY: number) => {
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, button: 2, clientX, clientY }));
    fireEvent.contextMenu(svg, { button: 2, clientX, clientY });
  };
  const actOnWaypoint = (name: string) => fireEvent.click(screen.getByRole('menuitem', { name }));
  const undo = () => {
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    host.drainJournal();
  };

  open(210, 204);
  actOnWaypoint('Lisa käänupunkt');
  expect(waypoints()).toEqual([original[0], inserted, original[1]]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.insertWaypoint',
  ]);
  undo();
  expect(waypoints()).toEqual(original);

  open(210, 204);
  actOnWaypoint('Lisa käänupunkt');
  host.drainJournal();
  open(219, 200);
  actOnWaypoint('Eemalda käänupunkt');
  expect(waypoints()).toEqual([original[0], inserted, original[1]]);
  expect(host.drainJournal()).toEqual([]);

  open(218, 200);
  actOnWaypoint('Eemalda käänupunkt');
  expect(waypoints()).toEqual(original);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.removeWaypoint',
  ]);
  undo();
  expect(waypoints()).toEqual([original[0], inserted, original[1]]);
});
