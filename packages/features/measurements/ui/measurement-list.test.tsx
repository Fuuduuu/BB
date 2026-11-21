// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
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

test('continuity_rows_show_beep_result', () => {
  const { clickPin } = mountMeasurements({
    seed: (doc) =>
      doc.measurements.push(
        measurement({
          id: 'msr_beep',
          mode: 'continuity',
          value: undefined,
          beep: true,
          ref: pinRef('2'),
          refLabel: 'U1.2',
        }),
        measurement({
          id: 'msr_silent',
          mode: 'continuity',
          value: undefined,
          beep: false,
          ref: pinRef('3'),
          refLabel: 'U1.3',
        }),
      ),
  });
  clickPin('1');

  const rows = openList().getAllByRole('listitem');
  for (const [ref, value] of [
    ['U1.2', 'piiksub'],
    ['U1.3', 'ei piiksu'],
  ] as const) {
    const row = within(rows.find((item) => within(item).queryByText(`→ ${ref}`))!);
    expect(row.getByText('Läbivus')).toBeTruthy();
    expect.soft(row.queryByText(value), `loendis peab olema „${value}“`).not.toBeNull();
  }

  const history = within(screen.getByRole('region', { name: 'Mõõtmised (2)' }));
  expect(history.getAllByRole('listitem').map((row) => row.textContent)).toEqual(
    expect.arrayContaining([
      'Läbivus · piiksub · U1.1 → U1.2',
      'Läbivus · ei piiksu · U1.1 → U1.3',
    ]),
  );
});

test('equal_time_readings_share_order', () => {
  const { clickPin, svg } = mountMeasurements({
    seed: (doc) =>
      doc.measurements.push(
        measurement({ id: 'msr_older', value: 3 }),
        measurement({ id: 'msr_newer', value: 8 }),
      ),
  });
  clickPin('1');

  const history = within(screen.getByRole('region', { name: 'Mõõtmised (2)' }));
  expect(history.getAllByRole('listitem')[0]?.textContent).toBe('8 V · U1.1');
  expect(svg.querySelector('[data-layer="measurements.readings"] text')?.textContent).toBe('8 V');
  const firstRow = openList().getAllByRole('listitem')[0]!;
  expect(firstRow.querySelector('strong')?.textContent).toBe('8 V');
});

test('history_delete_is_icon_with_named_tooltip', () => {
  mountMeasurements({
    seed: (doc) =>
      doc.measurements.push(
        measurement({ ref: pinRef('3'), refLabel: 'U1.3' }),
        measurement({ id: 'msr_second', atLabel: 'U1.2', value: 0.045 }),
      ),
  });

  const list = openList();
  for (const name of ['Kustuta mõõtmine 4,98 V U1.1 → U1.3', 'Kustuta mõõtmine 45 mV U1.2']) {
    const button = list.getByRole('button', { name });
    expect(button.title).toBe('Kustuta mõõtmine');
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    button.focus();
    expect(document.activeElement).toBe(button);
  }
});

test('history_row_keeps_power_and_time_on_one_line', () => {
  mountMeasurements({
    seed: (doc) => doc.measurements.push(measurement({ ref: pinRef('3'), refLabel: 'U1.3' })),
  });
  const style = document.createElement('style');
  style.textContent = [
    'packages/ui/src/kit/tokens.css',
    'packages/ui/src/kit/kit.css',
    'packages/features/measurements/ui/measurement-list.css',
  ]
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  document.head.appendChild(style);
  try {
    const row = openList().getByRole('listitem');
    const value = within(row).getByText('4,98 V');
    const pair = within(row).getByText('U1.1').parentElement!;
    const power = within(row).getByText('Sees');
    const time = row.querySelector('time')!;
    const metadata = time.parentElement!;
    expect(power.parentElement).toBe(metadata);
    expect(metadata.contains(value)).toBe(false);
    expect(Array.from(value.parentElement!.children).slice(0, 3)).toEqual([value, pair, metadata]);
    expect(getComputedStyle(metadata).flexWrap).toBe('nowrap');
    expect(getComputedStyle(metadata).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(metadata).fontSize).toBe('11px');
    expect(getComputedStyle(value).fontSize).toBe('15px');
    expect(getComputedStyle(value).fontWeight).toBe('600');
    expect(getComputedStyle(value).fontFamily).toContain('Martian Mono');
    expect(getComputedStyle(value).fontVariantNumeric).toBe('tabular-nums');
    expect(getComputedStyle(pair).fontSize).toBe('12px');
    expect(getComputedStyle(within(row).getByRole('button')).width).toBe('28px');
  } finally {
    style.remove();
  }
});

test('history_long_value_can_wrap_without_losing_digits', () => {
  mountMeasurements({
    seed: (doc) => doc.measurements.push(measurement({ value: 1e29 })),
  });
  const style = document.createElement('style');
  style.textContent = readFileSync(
    'packages/features/measurements/ui/measurement-list.css',
    'utf8',
  );
  document.head.appendChild(style);
  try {
    const value = openList().getByText('100000000000000000000000000000 V');
    expect(getComputedStyle(value).overflowWrap).toBe('anywhere');
    expect(getComputedStyle(value).minWidth).toBe('0px');
  } finally {
    style.remove();
  }
});

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
  fireEvent.click(list.getByRole('button', { name: 'Kustuta mõõtmine 4,98 V U1.1' }));
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
  expect(continuity.getByText('piiksub')).toBeTruthy();
  expect(list.getByText('0 V')).toBeTruthy();
  fireEvent.click(diode.getByRole('button', { name: 'Kustuta mõõtmine OL U1.1' }));
  expect(engine.snapshot().doc.measurements.map(({ id }) => id)).toEqual([
    'msr_resistance',
    'msr_continuity',
    'msr_voltage',
  ]);
  expect(screen.getByRole('tab', { name: 'Mõõtmised' })).toBeTruthy();
  expect(screen.getByText('3 mõõtmist')).toBeTruthy();
});
