// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Measurement } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../../measurements/__tests__/workspace';
import { projectDrawingSegment, wirePath } from './connection-geometry';

const end = (junction: string) => ({ junction });
const pinEnd = (p: string) => ({ pin: { c: 'cmp_u1', p } });

function continuity(id: string, at: string, ref: string, beep: boolean): Measurement {
  return {
    id,
    mode: 'continuity',
    at: pinRef(at),
    ref: pinRef(ref),
    atLabel: `U1.${at}`,
    refLabel: `U1.${ref}`,
    beep,
    source: 'manual',
    power: 'unknown',
    takenAt: '2026-11-10T10:00:00.000Z',
  };
}

test('traces_render_by_layer_and_menu_offers_drawing_actions', () => {
  const { engine, host, registry, svg } = mountMeasurements({
    seed(doc) {
      doc.junctions.push(
        { id: 'jun_open', board: { at: { x: 80, y: 220 }, layer: 'top' } },
        { id: 'jun_branch', board: { at: { x: 180, y: 220 }, layer: 'top' } },
        { id: 'jun_right', board: { at: { x: 280, y: 220 }, layer: 'top' } },
        { id: 'jun_lower', board: { at: { x: 80, y: 320 }, layer: 'bottom' } },
        { id: 'jun_lower_right', board: { at: { x: 180, y: 320 }, layer: 'bottom' } },
        { id: 'jun_air', board: { at: { x: 80, y: 420 }, layer: 'top' } },
        { id: 'jun_air_right', board: { at: { x: 180, y: 420 }, layer: 'top' } },
      );
      doc.connections.push(
        {
          id: 'con_top',
          a: end('jun_open'),
          b: end('jun_branch'),
          basis: 'visual',
          board: { kind: 'trace', layer: 'top', waypoints: [{ x: 120, y: 220 }], widthMm: 0.6 },
        },
        {
          id: 'con_wire',
          a: end('jun_branch'),
          b: end('jun_right'),
          basis: 'visual',
          board: { kind: 'wire', layer: 'top', waypoints: [], widthMm: 0.2 },
        },
        {
          id: 'con_bottom',
          a: end('jun_lower'),
          b: end('jun_lower_right'),
          basis: 'visual',
          board: { kind: 'trace', layer: 'bottom', waypoints: [], widthMm: 0.01 },
        },
        { id: 'con_air', a: end('jun_air'), b: end('jun_air_right'), basis: 'assumed' },
      );
    },
  });
  const traceLayer = svg.querySelector('[data-layer="connections.traces"]');
  const junctionLayer = svg.querySelector('[data-layer="connections.junctions"]');
  const top = traceLayer?.querySelector('polyline[stroke="var(--top)"]');
  const bottom = traceLayer?.querySelector('polyline[stroke="var(--bottom)"]');
  const wire = traceLayer?.querySelector('path[stroke="var(--wire)"]');
  expect(top?.getAttribute('stroke-width')).toBe('6');
  expect(bottom?.getAttribute('stroke-width')).toBe('1.4');
  expect(bottom?.getAttribute('opacity')).toBe('0.3');
  expect(wire?.getAttribute('d')).toBe('M 180 220 Q 230 250 280 220');
  const reversed = [
    { x: 280, y: 220 },
    { x: 180, y: 220 },
  ] as const;
  expect(wirePath(reversed)).toBe('M 280 220 Q 230 250 180 220');
  const projected = projectDrawingSegment({ x: 230, y: 236 }, ...reversed, 'wire');
  expect(projected.x).toBeCloseTo(230);
  expect(projected.y).toBeCloseTo(235);
  expect(junctionLayer?.querySelector('circle[cx="80"][cy="220"]')?.getAttribute('fill')).toBe(
    'none',
  );
  expect(junctionLayer?.querySelector('circle[cx="180"][cy="220"]')?.getAttribute('r')).toBe('7.5');
  expect(junctionLayer?.querySelector('circle[cx="80"][cy="320"]')?.getAttribute('r')).toBe('2.5');
  expect(svg.querySelectorAll('[data-layer="connections.airLines"] line')).toHaveLength(1);

  const menu = () => within(screen.getByRole('menu', { name: 'Toimingud' }));
  const open = (clientX: number, clientY: number) => {
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, button: 2, clientX, clientY }));
    fireEvent.contextMenu(svg, { button: 2, clientX, clientY });
  };
  open(230, 220);
  expect(screen.queryByRole('menuitem', { name: 'Eemalda joonistus' })).toBeNull();
  open(230, 235);
  expect(menu().getByRole('menuitem', { name: 'Eemalda joonistus' })).toBeTruthy();
  open(130, 220);
  expect(menu().queryByRole('menuitem', { name: 'Joonista rada fotol' })).toBeNull();
  expect(menu().getByRole('menuitem', { name: 'Kustuta ühendus' })).toBeTruthy();
  fireEvent.click(menu().getByRole('menuitem', { name: 'Eemalda joonistus' }));
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'connections.removeBoardDrawing',
  ]);
  expect(
    engine.snapshot().doc.connections.find(({ id }) => id === 'con_top')?.board,
  ).toBeUndefined();

  fireEvent.keyDown(svg, { key: 'F10', shiftKey: true });
  expect(menu().getByRole('menuitem', { name: 'Joonista rada fotol' })).toBeTruthy();
  expect(menu().queryByRole('menuitem', { name: 'Eemalda joonistus' })).toBeNull();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

  open(80, 220);
  expect(menu().getByRole('menuitem', { name: 'Kustuta liitepunkt (1 ühendus)' })).toBeTruthy();
  expect(
    registry.selectionLabel(engine.snapshot(), { items: [{ kind: 'junction', id: 'jun_open' }] }),
  ).toBe('Liitepunkt · 1 ühendus');
});

test('measured_trace_and_air_line_show_check_mark', () => {
  const { svg } = mountMeasurements({
    seed(doc) {
      doc.components[0]!.board!.params.pitch = 2;
      doc.connections.push(
        {
          id: 'con_measured_trace',
          a: pinEnd('1'),
          b: pinEnd('2'),
          basis: 'visual',
          board: {
            kind: 'trace',
            layer: 'top',
            waypoints: [
              { x: 130, y: 130 },
              { x: 150, y: 130 },
            ],
            widthMm: 1,
          },
        },
        {
          id: 'con_other_trace',
          a: pinEnd('3'),
          b: pinEnd('4'),
          basis: 'visual',
          board: { kind: 'trace', layer: 'top', waypoints: [], widthMm: 1 },
        },
        {
          id: 'con_measured_air',
          a: pinEnd('2'),
          b: pinEnd('4'),
          basis: 'assumed',
        },
        { id: 'con_other_air', a: pinEnd('2'), b: pinEnd('3'), basis: 'assumed' },
        {
          id: 'con_measured_wire',
          a: pinEnd('1'),
          b: pinEnd('4'),
          basis: 'visual',
          board: { kind: 'wire', layer: 'top', waypoints: [], widthMm: 1 },
        },
      );
      doc.measurements.push(
        continuity('msr_trace', '1', '2', true),
        continuity('msr_air', '2', '4', true),
        continuity('msr_wire', '1', '4', true),
      );
    },
  });
  const markPositions = (layer: string) =>
    Array.from(svg.querySelectorAll(`[data-layer="connections.${layer}"] text`), (mark) => [
      mark.textContent,
      Number(mark.getAttribute('x')),
      Number(mark.getAttribute('y')),
    ]);
  expect.soft(markPositions('traces')).toEqual([
    ['✓', 140, 130],
    ['✓', 160, 109],
  ]);
  expect.soft(markPositions('airLines')).toEqual([['✓', 170, 100]]);
  expect(
    Array.from(svg.querySelectorAll('[data-layer="connections.airLines"] line'), (line) =>
      line.getAttribute('stroke-dasharray'),
    ),
  ).toEqual(['2 3', '6 4']);
});

test('connection_context_shows_measured_and_warning', () => {
  mountMeasurements({
    seed(doc) {
      doc.connections.push(
        { id: 'con_measured', a: pinEnd('1'), b: pinEnd('2'), basis: 'assumed' },
        { id: 'con_no_continuity', a: pinEnd('3'), b: pinEnd('4'), basis: 'assumed' },
      );
      doc.measurements.push(
        continuity('msr_measured', '1', '2', true),
        continuity('msr_no_continuity', '3', '4', false),
      );
    },
  });
  const selectConnection = (id: string) =>
    act(() => useSessionStore.getState().setSelection({ items: [{ kind: 'connection', id }] }));
  const context = () => within(screen.getByRole('complementary', { name: 'Omadused' }));

  selectConnection('con_measured');
  expect.soft(context().queryByText('Mõõdetud ✓')).not.toBeNull();
  expect(context().queryByRole('alert')).toBeNull();

  selectConnection('con_no_continuity');
  expect(context().queryByText('Mõõdetud ✓')).toBeNull();
  expect(context().queryByRole('alert')?.textContent).toBe('Läbivustest ütles, et ühendust pole');
});
