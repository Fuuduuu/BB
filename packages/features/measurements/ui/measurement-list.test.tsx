// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import type { Measurement } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../__tests__/workspace';
import { snapshot } from '../../../client/src/__tests__/fakes';
import { createMeasurementsUi } from './index';

test('measurement_summary_uses_singular_and_plural', () => {
  const tab = createMeasurementsUi({ newId: () => 'unused' }).navigatorTabs![0]!;
  for (const [count, expected] of [
    [0, null],
    [1, '1 mõõtmine'],
    [2, '2 mõõtmist'],
    [1500, '1500 mõõtmist'],
  ] as const) {
    const initial = snapshot();
    const current = {
      ...initial,
      doc: {
        ...initial.doc,
        measurements: Array.from({ length: count }, (_, index) =>
          measurement({ id: `msr_${index}` }),
        ),
      },
    };
    expect(tab.summary?.(current)).toBe(expected);
  }
});

const takenAt = '2026-11-10T10:07:00.1Z';

function measurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    id: 'msr_first',
    mode: 'voltage',
    at: pinRef('1'),
    atLabel: 'U1.1',
    value: 4.98,
    power: 'on',
    takenAt,
    source: 'manual',
    ...overrides,
  };
}

function openList() {
  const name = 'Mõõtmised';
  fireEvent.click(screen.getByRole('tab', { name }));
  return within(screen.getByRole('tabpanel', { name }));
}

test('list_marks_historical_measurements', () => {
  mountMeasurements({
    seed: (doc) => {
      doc.measurements.push(
        measurement({
          atLabel: 'U1.1',
          ref: { ...pinRef('4'), uid: 'pin_old_ref' },
          refLabel: 'J4.4',
        }),
        measurement({
          id: 'msr_latest',
          at: { ...pinRef('1'), uid: 'pin_old_at' },
          atLabel: 'R7.1',
          value: 0.045,
          power: 'off',
          takenAt: '2026-11-10T10:07:00.19Z',
        }),
      );
    },
  });

  const list = openList();
  const rows = list.getAllByRole('listitem');
  const latest = within(rows[0]!);
  const oldest = within(rows[1]!);
  expect(latest.getByText('R7.1')).toBeTruthy();
  expect(latest.getByText('45 mV')).toBeTruthy();
  expect(latest.getByText('Väljas')).toBeTruthy();
  expect(latest.getByText('kontakt kustutatud')).toBeTruthy();
  expect(oldest.getByText('U1.1')).toBeTruthy();
  expect(oldest.getByText('→ J4.4')).toBeTruthy();
  expect(oldest.getByText('kontakt kustutatud')).toBeTruthy();
  const localHour = String(new Date(takenAt).getHours()).padStart(2, '0');
  expect(oldest.getByText(`${localHour}:07`).getAttribute('datetime')).toBe(takenAt);
});

test('list_remove_is_undoable', () => {
  const { engine, host } = mountMeasurements({
    seed: (doc) => doc.measurements.push(measurement()),
  });

  const list = openList();
  fireEvent.click(list.getByRole('button', { name: 'Kustuta' }));
  expect(engine.snapshot().doc.measurements).toEqual([]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['measurements.remove']);
  expect(screen.getByRole('tab', { name: 'Mõõtmised' })).toBeTruthy();
  expect(list.getByText(/Vali jalg ja sisesta väärtus/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Võta tagasi' }));
  expect(engine.snapshot().doc.measurements).toEqual([measurement()]);
  expect(list.getByText('4,98 V')).toBeTruthy();
});

test('list_displays_and_removes_legacy_modes', () => {
  const { engine } = mountMeasurements({
    seed: (doc) => {
      doc.measurements.push(
        measurement({ id: 'msr_resistance', mode: 'resistance', value: 2000 }),
        measurement({ id: 'msr_diode', mode: 'diode', overload: true, value: undefined }),
        measurement({ id: 'msr_continuity', mode: 'continuity', beep: true, value: undefined }),
        measurement({ id: 'msr_voltage', value: 0 }),
      );
    },
  });

  const list = openList();
  const rows = list.getAllByRole('listitem');
  const resistance = within(rows.find((row) => within(row).queryByText('Takistus'))!);
  const diode = within(rows.find((row) => within(row).queryByText('Diood'))!);
  const continuity = within(rows.find((row) => within(row).queryByText('Läbivus'))!);
  expect(resistance.getByText('—')).toBeTruthy();
  expect(diode.getByText('OL')).toBeTruthy();
  expect(continuity.getByText('—')).toBeTruthy();
  expect(list.getByText('0 V')).toBeTruthy();
  fireEvent.click(diode.getByRole('button', { name: 'Kustuta' }));
  expect(engine.snapshot().doc.measurements.map(({ id }) => id)).toEqual([
    'msr_resistance',
    'msr_continuity',
    'msr_voltage',
  ]);
  expect(screen.getByRole('tab', { name: 'Mõõtmised' })).toBeTruthy();
  expect(screen.getByText('3 mõõtmist')).toBeTruthy();
});
