// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import type { BoardDoc, Component, EndRef, Vec2 } from '@pcbk/domain';
import { monoLabelHalf, screenBoxesOverlap, useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../../measurements/__tests__/workspace';

const pinEnd = (c: string, p: string): EndRef => ({ pin: { c, p } });
const junctionEnd = (junction: string): EndRef => ({ junction });

function placedPart(part: Component, id: string, ref: string, pin: string, at: Vec2): Component {
  return {
    ...part,
    id,
    ref,
    value: '',
    pins: [{ id: pin, uid: `pin_${id}_${pin}`, nc: false }],
    board: {
      footprint: 'area',
      params: { w: 2, h: 2 },
      center: at,
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: { [pin]: { local: { x: 0, y: 0 }, sizeMm: 1, shape: 'circle', through: true } },
    },
  };
}

function addTrace(doc: BoardDoc, id: string, a: EndRef, b: EndRef, waypoints: Vec2[] = []) {
  doc.connections.push({
    id,
    a,
    b,
    basis: 'visual',
    board: { kind: 'trace', layer: 'top', widthMm: 0.3, waypoints },
  });
}

function addJunctionTrace(doc: BoardDoc, id: string, start: Vec2, end: Vec2, waypoints?: Vec2[]) {
  const a = `jun_${id}_a`;
  const b = `jun_${id}_b`;
  doc.junctions.push(
    { id: a, board: { at: start, layer: 'top' } },
    { id: b, board: { at: end, layer: 'top' } },
  );
  addTrace(doc, `con_${id}`, junctionEnd(a), junctionEnd(b), waypoints);
  return junctionEnd(a);
}

function traceLabel(svg: SVGSVGElement, id: string) {
  return svg.querySelector<SVGTextElement>(
    `[data-layer="connections.traceLabels"] text[data-trace-label="${id}"]`,
  );
}

function textCenter(text: SVGTextElement) {
  const x = Number(text.getAttribute('x'));
  const y = Number(text.getAttribute('y'));
  expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  return { x, y };
}

function labelCenter(svg: SVGSVGElement, id: string) {
  const text = traceLabel(svg, id);
  expect(text).not.toBeNull();
  return textCenter(text!);
}

function signal(svg: SVGSVGElement, type: string, at: Vec2) {
  pointer(svg, type, at.x, at.y);
}

test('trace_label_drag_is_one_step_and_survives_reopen', () => {
  const app = mountMeasurements({
    seed(doc) {
      const part = doc.components[0]!;
      doc.components = [
        placedPart(part, 'cmp_r1', 'R1', '2', { x: 100, y: 160 }),
        placedPart(part, 'cmp_u1', 'U1', '5', { x: 360, y: 160 }),
      ];
      const source = pinEnd('cmp_r1', '2');
      addTrace(doc, 'con_vbus', source, pinEnd('cmp_u1', '5'), [{ x: 135, y: 160 }]);
      addJunctionTrace(doc, 'unnamed', { x: 100, y: 280 }, { x: 360, y: 280 });
      doc.netLabels.push({ id: 'lbl_vbus', anchor: source, name: 'VBUS', source: 'user' });
    },
  });
  const { engine, host } = app;
  let svg = app.svg;
  const label = () => traceLabel(svg, 'con_vbus');
  const center = () => labelCenter(svg, 'con_vbus');
  const before = engine.snapshot().doc;
  expect(label()?.textContent).toBe('VBUS');
  expect(traceLabel(svg, 'con_unnamed')).toBeNull();
  const automatic = center();
  expect(automatic.x).toBeCloseTo(247.5);
  expect(Math.abs(automatic.y - 160)).toBeGreaterThan(4);

  const destination = { x: automatic.x + 48, y: automatic.y + 36 };
  signal(svg, 'pointerdown', automatic);
  signal(svg, 'pointermove', destination);
  expect(center()).toEqual(destination);
  expect(engine.snapshot().doc).toBe(before);
  expect(host.drainJournal()).toEqual([]);
  signal(svg, 'pointerup', destination);
  expect(center()).toEqual(destination);
  const saved = JSON.parse(JSON.stringify(engine.snapshot().doc)) as BoardDoc;
  expect(saved.connections[0]?.board?.labelOffset).toEqual({
    x: destination.x - 247.5,
    y: destination.y - 160,
  });
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.setLabelOffset',
  ]);

  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
  expect(engine.snapshot().doc.connections).toEqual(before.connections);
  expect(center()).toEqual(automatic);
  act(() => host.load('measurement-reopened', saved, false));
  svg = app.svg;
  expect(center()).toEqual(destination);
  host.drainJournal();

  signal(svg, 'pointerdown', destination);
  signal(svg, 'pointerup', destination);
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'connection', id: 'con_vbus' },
  ]);
  expect(screen.getByText('R1.2 → U1.5')).toBeTruthy();
  expect(screen.getByText('Alus: nähtud')).toBeTruthy();
  expect(screen.getByText('Võrk: VBUS')).toBeTruthy();
  expect(screen.getByText('Rada · pealmine · 0,30 mm')).toBeTruthy();

  const contextClick = { button: 2, clientX: destination.x, clientY: destination.y };
  fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, ...contextClick }));
  fireEvent.contextMenu(svg, contextClick);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Lähtesta sildi asukoht' }));
  expect(engine.snapshot().doc.connections[0]?.board?.labelOffset).toBeUndefined();
  expect(center()).toEqual(automatic);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.setLabelOffset',
  ]);
});

test('labels_do_not_overlap_each_other', () => {
  const { engine, registry, svg } = mountMeasurements({
    seed(doc) {
      const part = doc.components[0]!;
      part.board!.center = { x: 230, y: 143 };
      part.board!.labelOffset = { x: 0, y: 0 };
      const first = addJunctionTrace(doc, 'alpha', { x: 80, y: 156 }, { x: 380, y: 156 });
      const second = addJunctionTrace(doc, 'beta', { x: 60, y: 158 }, { x: 440, y: 158 }, [
        { x: 360, y: 158 },
      ]);
      const short = addJunctionTrace(doc, 'short', { x: 60, y: 240 }, { x: 74, y: 240 });
      doc.netLabels.push(
        { id: 'lbl_alpha', anchor: first, name: 'VBUS', source: 'user' },
        { id: 'lbl_beta', anchor: second, name: 'VCORE', source: 'user' },
        { id: 'lbl_short', anchor: short, name: 'LONG_NAME', source: 'user' },
      );
    },
  });
  const alpha = {
    owner: 'trace-test',
    center: labelCenter(svg, 'con_alpha'),
    half: monoLabelHalf('VBUS', 11, 1),
  };
  const beta = {
    owner: 'trace-test',
    center: labelCenter(svg, 'con_beta'),
    half: monoLabelHalf('VCORE', 11, 1),
  };
  const renderedObstacles = registry
    .canvasLayers()
    .flatMap((layer) => layer.obstacles?.(engine.snapshot(), 1, 'none') ?? []);
  const componentLabel = renderedObstacles.find((box) => box.componentId === 'cmp_u1');
  expect(componentLabel).toBeDefined();
  const blocked = { ...alpha, center: { x: 230, y: 156 - 4 - alpha.half.y } };
  expect(screenBoxesOverlap(blocked, componentLabel!, 'none')).toBe(true);
  expect(screenBoxesOverlap(alpha, componentLabel!, 'none')).toBe(false);
  expect(screenBoxesOverlap(beta, componentLabel!, 'none')).toBe(false);
  expect(screenBoxesOverlap(alpha, beta, 'none')).toBe(false);
  expect(traceLabel(svg, 'con_short')).toBeNull();
});
