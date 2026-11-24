// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import type { BoardDoc, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../__tests__/workspace';

const beepTool = 'measurements.beep';
const connectName = /^Piiksub ja ühenda/u;
const anchorLabel = (ref: string) => `Must sond · ${ref}`;

function storedBeep(at: string, ref: string, beep: boolean, component = 'U1') {
  return {
    id: expect.any(String),
    mode: 'continuity',
    at: pinRef(at),
    atLabel: `${component}.${at}`,
    ref: pinRef(ref),
    refLabel: `${component}.${ref}`,
    beep,
    power: 'unknown',
    takenAt: expect.any(String),
    source: 'beep_mode',
  };
}

function storedLink(anchor: string, target: string) {
  return {
    id: expect.any(String),
    a: { pin: { c: 'cmp_u1', p: anchor } },
    b: { pin: { c: 'cmp_u1', p: target } },
    basis: 'assumed',
  };
}

function shiftClick(svg: SVGSVGElement, at: Vec2) {
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX: at.x,
      clientY: at.y,
      shiftKey: true,
    });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  }
}

function fivePinConnector(doc: BoardDoc) {
  const part = doc.components[0]!;
  part.pins.push({ id: '5', uid: pinRef('5').uid, nc: false });
  part.board!.params.pins = 5;
}

test('beep_tool_anchor_then_enter_connects', () => {
  const { clickPin, engine, host, svg } = mountMeasurements({ seed: fivePinConnector });

  fireEvent.keyDown(svg, { key: 'b' });
  expect(useSessionStore.getState().toolId).toBe(beepTool);
  expect(screen.getByText('Klõpsa jalal, kus on must sond')).toBeTruthy();
  clickPin('4');
  expect(screen.getByText(anchorLabel('U1.4')).closest('svg')).toBe(svg);
  clickPin('3');
  const connect = screen.getByRole('button', { name: connectName });
  expect(connect.closest('svg')).toBeNull();
  expect(connect.closest<HTMLElement>('[data-canvas-hud]')?.style.position).toBe('absolute');
  expect(connect.textContent).toContain('Enter');
  expect(screen.getByRole('button', { name: /^Ainult mõõtmine/u }).textContent).toContain(
    'Shift+Enter',
  );
  expect(screen.getByRole('button', { name: /^Ei piiksu/u }).textContent).toContain('N');
  fireEvent.keyDown(svg, { key: 'Enter', repeat: true });
  expect(engine.snapshot().doc.measurements).toEqual([]);
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(engine.snapshot().doc.measurements).toEqual([storedBeep('3', '4', true)]);
  expect(engine.snapshot().doc.connections).toEqual([storedLink('4', '3')]);
  expect(screen.queryByRole('button', { name: connectName })).toBeNull();
  expect(screen.getByText(anchorLabel('U1.4'))).toBeTruthy();

  clickPin('5');
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(engine.snapshot().doc.measurements).toEqual([
    storedBeep('3', '4', true),
    storedBeep('5', '4', true),
  ]);
  expect(engine.snapshot().doc.connections).toEqual([storedLink('4', '3'), storedLink('4', '5')]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'beep.record',
    'beep.record',
  ]);
});

test('beep_tool_shift_enter_and_n_record_only', () => {
  const { clickPin, engine, svg } = mountMeasurements();

  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('4');
  clickPin('3');
  expect(screen.getByRole('button', { name: /^Ainult mõõtmine/u })).toBeTruthy();
  fireEvent.keyDown(svg, { key: 'Enter', shiftKey: true });
  expect(engine.snapshot().doc.measurements).toEqual([storedBeep('3', '4', true)]);
  expect(engine.snapshot().doc.connections).toEqual([]);

  clickPin('1');
  fireEvent.keyDown(svg, { key: 'n' });
  expect(engine.snapshot().doc.measurements).toEqual([
    storedBeep('3', '4', true),
    storedBeep('1', '4', false),
  ]);
  expect(engine.snapshot().doc.connections).toEqual([]);
});

test('beep_tool_escape_saves_nothing_then_exits', () => {
  const { clickPin, engine, host, svg } = mountMeasurements();

  fireEvent.keyDown(svg, { key: 't' });
  clickPin('1');
  expect(svg.querySelector('[data-trace-preview]')).toBeTruthy();
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(svg.querySelector('[data-trace-preview]')).toBeNull();

  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('4');
  clickPin('3');
  expect(screen.getByRole('button', { name: connectName })).toBeTruthy();
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(useSessionStore.getState().toolId).toBe(beepTool);
  expect(screen.queryByRole('button', { name: connectName })).toBeNull();
  expect(screen.getByText(anchorLabel('U1.4'))).toBeTruthy();
  expect(engine.snapshot().doc.measurements).toEqual([]);
  expect(engine.snapshot().doc.connections).toEqual([]);

  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(screen.queryByText(anchorLabel('U1.4'))).toBeNull();
  expect(host.drainJournal()).toEqual([]);
});

test('beep_tool_shift_click_sets_new_anchor', () => {
  const { clickPin, engine, svg } = mountMeasurements({
    seed(doc) {
      const part = doc.components[0]!;
      doc.components.push({
        ...part,
        id: 'cmp_u2',
        ref: 'U2',
        pins: [{ id: '1', uid: 'pin_u2_1', nc: false }],
        board: {
          ...part.board!,
          params: { pins: 1, pitch: 2.54 },
          center: { x: 300, y: 100 },
        },
      });
    },
  });
  const { doc } = engine.snapshot();
  const [pad] = boardPads(doc.components[1]!.board!, ['1'], doc.scale.pxPerMm);

  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('4');
  clickPin('3');
  expect(screen.getByRole('button', { name: connectName })).toBeTruthy();
  shiftClick(svg, pad!.at);
  expect(screen.getByText(anchorLabel('U2.1')).closest('svg')).toBe(svg);
  expect(screen.queryByText(anchorLabel('U1.4'))).toBeNull();
  expect(screen.queryByRole('button', { name: connectName })).toBeNull();
  expect(engine.snapshot().doc.measurements).toEqual([]);
  expect(engine.snapshot().doc.connections).toEqual([]);
});

test('beep_tool_guard_asks_before_connecting', () => {
  const { clickPin, engine, host, svg } = mountMeasurements({
    seed(doc) {
      const part = doc.components[0]!;
      part.kind = 'resistor';
      part.ref = 'R5';
      part.pins.splice(2);
      part.board!.params.pins = 2;
    },
  });
  const question = 'Piiksub läbi komponendi R5. Ühendan ikkagi?';

  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('1');
  clickPin('2');
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(screen.getByText(question).closest('svg')).toBeNull();
  expect(engine.snapshot().doc.measurements).toEqual([storedBeep('2', '1', true, 'R5')]);
  expect(engine.snapshot().doc.connections).toEqual([]);

  fireEvent.click(screen.getByRole('button', { name: /^Jäta ühendamata/u }));
  expect(screen.queryByText(question)).toBeNull();
  expect(engine.snapshot().doc.measurements).toEqual([storedBeep('2', '1', true, 'R5')]);
  expect(engine.snapshot().doc.connections).toEqual([]);

  clickPin('2');
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(screen.getByText(question)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^Ühenda ikkagi/u }));
  expect(screen.queryByText(question)).toBeNull();
  expect(engine.snapshot().doc.connections).toEqual([storedLink('1', '2')]);
  const measurements = engine.snapshot().doc.measurements;
  expect(measurements).toEqual([
    storedBeep('2', '1', true, 'R5'),
    storedBeep('2', '1', true, 'R5'),
  ]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'beep.record',
    'beep.record',
    'connections.add',
  ]);
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(engine.snapshot().doc.connections).toEqual([]);
  expect(engine.snapshot().doc.measurements).toEqual(measurements);
});
