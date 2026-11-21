// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import type { EndRef } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../../measurements/__tests__/workspace';

const pin = (p: string): EndRef => ({ pin: { c: 'cmp_u1', p } });

test('net_view_counts_measured_connections', () => {
  const { engine } = mountMeasurements({
    seed(doc) {
      doc.connections.push(
        { id: 'con_measured', a: pin('1'), b: pin('2'), basis: 'assumed' },
        { id: 'con_unmeasured', a: pin('2'), b: pin('3'), basis: 'assumed' },
      );
      doc.netLabels.push({ id: 'lbl_signal', anchor: pin('1'), name: 'Signaal', source: 'user' });
      doc.measurements.push({
        id: 'msr_beep',
        mode: 'continuity',
        at: pinRef('2'),
        atLabel: 'U1.2',
        ref: pinRef('1'),
        refLabel: 'U1.1',
        beep: true,
        power: 'unknown',
        takenAt: '2026-11-21T10:00:00.000Z',
        source: 'beep_mode',
      });
    },
  });

  expect(engine.snapshot().derived.connectionLevels).toEqual({
    con_measured: { level: 'measured' },
    con_unmeasured: { level: 'assumed' },
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Võrgud' }));
  const pane = within(screen.getByRole('tabpanel', { name: 'Võrgud' }));
  fireEvent.click(pane.getByRole('button', { name: 'Signaal · 3 liiget' }));
  expect(pane.getByText('Mõõdetud ühendusi 1/2')).toBeTruthy();
});
