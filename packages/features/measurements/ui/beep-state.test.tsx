// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import type { EndRef } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../__tests__/workspace';

const ground: EndRef = { pin: { c: 'cmp_u1', p: '1' } };
const power: EndRef = { pin: { c: 'cmp_u1', p: '4' } };
const connect = 'Piiksub ja ühenda';
const confirm = 'Ühenda ikkagi';

type Engine = ReturnType<typeof mountMeasurements>['engine'];

function counts(engine: Engine) {
  const { measurements, connections } = engine.snapshot().doc;
  return { measurements: measurements.length, connections: connections.length };
}

function undo(svg: SVGSVGElement) {
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
}

test('guard_confirm_skips_already_joined_pins', () => {
  const { clickPin, engine, host, svg } = mountMeasurements({
    seed(doc) {
      doc.connections.push(
        { id: 'con_ground', a: ground, b: { pin: { c: 'cmp_u1', p: '2' } }, basis: 'visual' },
        { id: 'con_power', a: power, b: { pin: { c: 'cmp_u1', p: '3' } }, basis: 'visual' },
      );
      doc.netLabels.push(
        { id: 'lbl_ground', anchor: ground, name: 'GND', roleId: 'rol_gnd', source: 'user' },
        { id: 'lbl_power', anchor: power, name: '5V', roleId: 'rol_5v', source: 'user' },
      );
    },
  });

  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('1');
  clickPin('4');
  fireEvent.keyDown(svg, { key: 'Enter' });
  const question = 'Ühendamine liidaks võrgud 5V ja GND. Ühendan ikkagi?';
  expect(screen.getByRole('dialog', { name: question })).toBeTruthy();
  expect(counts(engine)).toEqual({ measurements: 1, connections: 2 });

  act(() => {
    expect(engine.execute('nets.join', { connectionId: 'con_join', a: ground, b: power }).ok).toBe(
      true,
    );
  });
  expect(counts(engine)).toEqual({ measurements: 1, connections: 3 });
  fireEvent.click(screen.getByRole('button', { name: confirm }));

  expect.soft(counts(engine)).toEqual({ measurements: 1, connections: 3 });
  expect.soft(screen.queryByRole('dialog', { name: question })).toBeNull();
  expect.soft(screen.queryByText('Mõõtmist või jalga ei leitud.')).toBeNull();
  expect.soft(screen.getByText('Must sond · U1.1').closest('svg')).toBe(svg);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'beep.record',
    'nets.join',
  ]);
});

test('beep_state_expires_with_undo', () => {
  const { clickPin, engine, svg } = mountMeasurements({
    seed(doc) {
      const resistor = doc.components[0]!;
      resistor.kind = 'resistor';
      resistor.ref = 'R1';
      resistor.pins.splice(2);
      resistor.board!.params.pins = 2;
      doc.components.push({
        ...resistor,
        id: 'cmp_j8',
        ref: 'J8',
        kind: 'connector',
        pins: [],
        board: {
          ...resistor.board!,
          footprint: 'area',
          params: { w: 3, h: 3 },
          center: { x: 300, y: 100 },
        },
      });
    },
  });

  function addAndClickJ8Pin() {
    act(() => {
      expect(
        engine.execute('components.addOwnPin', {
          id: 'cmp_j8',
          pin: { id: '1', uid: 'pin_j8_1' },
          local: { x: 0, y: 0 },
          sizeMm: 1,
        }).ok,
      ).toBe(true);
    });
    pointer(svg, 'pointerdown', 300, 100);
    pointer(svg, 'pointerup', 300, 100);
  }

  fireEvent.keyDown(svg, { key: 'b' });
  addAndClickJ8Pin();
  expect(screen.getByText('Must sond · J8.1').closest('svg')).toBe(svg);
  expect(counts(engine)).toEqual({ measurements: 0, connections: 0 });
  undo(svg);
  expect(engine.snapshot().doc.components.find(({ id }) => id === 'cmp_j8')?.pins).toEqual([]);
  expect.soft(screen.queryByText('Must sond · J8.1')).toBeNull();
  expect.soft(svg.querySelector('circle[stroke="var(--bottom)"]')).toBeNull();
  expect.soft(screen.queryByText('Klõpsa jalal, kus on must sond')).not.toBeNull();
  expect(counts(engine)).toEqual({ measurements: 0, connections: 0 });

  clickPin('1');
  expect.soft(screen.queryByText('Must sond · R1.1')?.closest('svg')).toBe(svg);
  expect.soft(screen.queryByRole('button', { name: connect })).toBeNull();
  expect(counts(engine)).toEqual({ measurements: 0, connections: 0 });

  // Start a fresh gesture so the next case runs even if the stale anchor assertion fails.
  fireEvent.keyDown(svg, { key: 'Escape' });
  fireEvent.keyDown(svg, { key: 'Escape' });
  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('1');
  addAndClickJ8Pin();
  expect(screen.getByRole('button', { name: connect })).toBeTruthy();
  undo(svg);
  expect.soft(screen.queryByRole('button', { name: connect })).toBeNull();
  expect.soft(svg.querySelector('circle[stroke="var(--danger)"]')).toBeNull();
  expect(screen.getByText('Must sond · R1.1').closest('svg')).toBe(svg);
  expect(counts(engine)).toEqual({ measurements: 0, connections: 0 });

  clickPin('2');
  fireEvent.keyDown(svg, { key: 'Enter' });
  const question = 'Piiksub läbi komponendi R1. Ühendan ikkagi?';
  expect(screen.getByRole('dialog', { name: question })).toBeTruthy();
  expect(counts(engine)).toEqual({ measurements: 1, connections: 0 });
  undo(svg);
  expect.soft(screen.queryByRole('dialog', { name: question })).toBeNull();
  expect.soft(screen.queryByRole('button', { name: confirm })).toBeNull();
  expect.soft(screen.queryByText('Mõõtmist või jalga ei leitud.')).toBeNull();
  expect(screen.getByText('Must sond · R1.1').closest('svg')).toBe(svg);
  expect(counts(engine)).toEqual({ measurements: 0, connections: 0 });
});
