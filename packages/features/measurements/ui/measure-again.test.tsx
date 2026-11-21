// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import type { Measurement } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../__tests__/workspace';

const timestamp = '2026-11-21T10:00:00.000Z';

function pinEnd(p: string) {
  return { pin: { c: pinRef(p).c, p } };
}

function selectConnection(id: string) {
  act(() => useSessionStore.getState().setSelection({ items: [{ id, kind: 'connection' }] }));
}

function continuity(id: string, first: string, second: string): Measurement {
  return {
    id,
    mode: 'continuity',
    at: pinRef(first),
    ref: pinRef(second),
    atLabel: `U1.${first}`,
    refLabel: `U1.${second}`,
    beep: true,
    power: 'unknown',
    takenAt: timestamp,
    source: 'manual',
  };
}

test('measure_again_button_opens_beep_with_both_probes', () => {
  const { engine, host, svg } = mountMeasurements({
    seed(doc) {
      doc.connections.push({ id: 'con_probe', a: pinEnd('4'), b: pinEnd('3'), basis: 'visual' });
    },
  });
  selectConnection('con_probe');
  const start = screen.getByRole('button', { name: 'Mõõda piiksuga' });
  start.focus();
  fireEvent.click(start);

  expect(useSessionStore.getState().toolId).toBe('measurements.beep');
  expect(screen.getByText('Must sond · U1.4').closest('svg')).toBe(svg);
  const action = screen.getByRole('button', { name: 'Piiksub ja ühenda' });
  expect(action.closest('[data-canvas-hud]')).toBeTruthy();
  expect(action.textContent).toContain('Enter');

  fireEvent.keyDown(start, { key: 'Enter' });
  const { doc, derived } = engine.snapshot();
  expect(doc.measurements).toMatchObject([
    { at: pinRef('3'), ref: pinRef('4'), beep: true, source: 'beep_mode' },
  ]);
  expect(doc.connections).toHaveLength(1);
  expect(derived.connectionLevels).toEqual({ con_probe: { level: 'measured' } });
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['beep.record']);
  expect(screen.queryByRole('button', { name: 'Mõõda piiksuga' })).toBeNull();
});

test('measure_again_label_after_stale_or_lost_contact', () => {
  mountMeasurements({
    seed(doc) {
      doc.components.push({
        id: 'cmp_unplaced',
        ref: 'U2',
        kind: 'connector',
        marking: '',
        value: '',
        identified: false,
        dnp: false,
        note: '',
        pins: [{ id: '1', uid: 'pin_unplaced', nc: false }],
      });
      doc.junctions.push({ id: 'jun_test' });
      doc.repairs.push({
        id: 'rep_stale',
        action: 'reflowed',
        text: '',
        at: timestamp,
        affects: { component: 'cmp_u1' },
      });
      doc.connections.push(
        { id: 'con_stale', a: pinEnd('1'), b: pinEnd('2'), basis: 'visual' },
        { id: 'con_historical', a: pinEnd('1'), b: pinEnd('3'), basis: 'visual' },
        { id: 'con_measured', a: pinEnd('1'), b: pinEnd('4'), basis: 'visual' },
        { id: 'con_junction', a: pinEnd('1'), b: { junction: 'jun_test' }, basis: 'assumed' },
        {
          id: 'con_unplaced',
          a: pinEnd('1'),
          b: { pin: { c: 'cmp_unplaced', p: '1' } },
          basis: 'assumed',
        },
      );
      doc.measurements.push(
        { ...continuity('msr_stale', '1', '2'), staleByRepairId: 'rep_stale' },
        { ...continuity('msr_historical', '3', '1'), at: { ...pinRef('3'), uid: 'pin_replaced' } },
        continuity('msr_current', '1', '4'),
      );
    },
  });

  for (const id of ['con_stale', 'con_historical']) {
    selectConnection(id);
    expect(screen.getByRole('button', { name: 'Mõõda uuesti' })).toBeTruthy();
  }
  for (const id of ['con_junction', 'con_measured', 'con_unplaced']) {
    selectConnection(id);
    expect(screen.queryByRole('button', { name: /^Mõõda (?:uuesti|piiksuga)$/u })).toBeNull();
  }
});
