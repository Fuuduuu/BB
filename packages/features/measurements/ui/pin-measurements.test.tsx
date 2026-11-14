// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react';
import type { Measurement } from '@pcbk/domain';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../__tests__/workspace';

function measurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    id: 'msr_first',
    mode: 'voltage',
    at: pinRef('1'),
    atLabel: 'U1.1',
    value: 4.73,
    power: 'on',
    takenAt: '2026-11-10T10:00:00.000Z',
    source: 'manual',
    ...overrides,
  };
}

function selectPin(id = '1', componentId = 'cmp_u1') {
  act(() => {
    useSessionStore.getState().setSelection({ items: [{ kind: 'pin', id, componentId }] });
    useViewStore.getState().setContextOpen(true);
  });
}

function readings(count: number) {
  return within(screen.getByRole('region', { name: `Mõõtmised (${count})` }));
}

test('pin_measurements_section_lists_pin_readings', () => {
  const { clickBlank, registry } = mountMeasurements({
    seed: (doc) => {
      doc.measurements.push(
        measurement({ ref: pinRef('4'), refLabel: 'U1.4' }),
        measurement({
          id: 'msr_ref',
          at: pinRef('2'),
          atLabel: 'U1.2',
          ref: pinRef('1'),
          refLabel: 'U1.1',
          value: 0.045,
          takenAt: '2026-11-10T10:01:00.000Z',
        }),
        measurement({ id: 'msr_other', at: pinRef('3'), atLabel: 'U1.3', value: 12 }),
      );
    },
  });
  clickBlank();
  selectPin();

  const section = readings(2);
  expect(section.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
    '45 mV · U1.2 → U1.1',
    '4,73 V · U1.1 → U1.4',
  ]);
  expect(registry.contextSections(useSessionStore.getState().selection)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'pin-measurements', appliesTo: ['pin'], order: 10 }),
    ]),
  );
});

test('pin_measurements_match_uid_instead_of_reused_contact_names', () => {
  const { clickBlank } = mountMeasurements({
    seed: (doc) => {
      doc.measurements.push(
        measurement({ at: { ...pinRef('1'), uid: 'pin_removed_1' }, value: 12 }),
        measurement({
          id: 'msr_historical_label',
          at: { c: 'cmp_old', p: '9', uid: pinRef('1').uid },
          atLabel: 'J9.9',
          value: 3.3,
        }),
      );
    },
  });
  clickBlank();
  selectPin();

  expect(
    readings(1)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['3,3 V · J9.9']);
});

test('pin_measurements_of_replaced_pin_exclude_previous_uid', () => {
  const { clickBlank, engine } = mountMeasurements({
    seed: (doc) => doc.measurements.push(measurement()),
  });
  clickBlank();
  act(() => {
    expect(engine.execute('components.removePin', { id: 'cmp_u1', pinId: '1' }).ok).toBe(true);
    expect(
      engine.execute('components.addPin', { id: 'cmp_u1', pin: { id: '1', uid: 'pin_new_1' } }).ok,
    ).toBe(true);
  });
  selectPin();

  expect(readings(0).getByText('Selle jalaga mõõtmisi pole.')).toBeTruthy();
  expect(engine.snapshot().doc.measurements).toHaveLength(1);
});

test('pin_measurements_keep_saved_pair_when_other_contact_is_missing', () => {
  const { clickBlank } = mountMeasurements({
    seed: (doc) => {
      doc.components[0]!.ref = 'U8';
      doc.measurements.push(
        measurement({
          ref: { c: 'cmp_removed', p: '3', uid: 'pin_removed_3' },
          refLabel: 'J7.3',
        }),
        measurement({
          id: 'msr_removed_at',
          at: { c: 'cmp_removed', p: '2', uid: 'pin_removed_2' },
          atLabel: 'J7.2',
          ref: pinRef('1'),
          refLabel: 'U1.1',
          value: 2.5,
          takenAt: '2026-11-10T10:01:00.000Z',
        }),
      );
    },
  });
  clickBlank();
  selectPin();

  expect(
    readings(2)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['2,5 V · J7.2 → U1.1', '4,73 V · U1.1 → J7.3']);
});

test('pin_measurements_keep_legacy_modes_named_without_assigning_voltage_units', () => {
  const { clickBlank } = mountMeasurements({
    seed: (doc) => {
      doc.measurements.push(
        measurement({ id: 'msr_resistance', mode: 'resistance', value: 2000 }),
        measurement({
          id: 'msr_diode',
          mode: 'diode',
          overload: true,
          value: undefined,
          takenAt: '2026-11-10T10:01:00.000Z',
        }),
        measurement({
          id: 'msr_continuity',
          mode: 'continuity',
          beep: true,
          value: undefined,
          takenAt: '2026-11-10T10:02:00.000Z',
        }),
      );
    },
  });
  clickBlank();
  selectPin();

  expect(
    readings(3)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Läbivus · — · U1.1', 'Diood · OL · U1.1', 'Takistus · — · U1.1']);
});

test('pin_measurements_equal_times_keep_latest_added_inside_five_row_limit', () => {
  const { clickBlank } = mountMeasurements({
    seed: (doc) => {
      for (let value = 1; value <= 6; value++) {
        doc.measurements.push(measurement({ id: `msr_${value}`, value }));
      }
    },
  });
  clickBlank();
  selectPin();
  expect(
    readings(6)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['6 V · U1.1', '5 V · U1.1', '4 V · U1.1', '3 V · U1.1', '2 V · U1.1']);
});

test('pin_measurements_show_five_newest_rows_and_total_count', () => {
  const { clickBlank } = mountMeasurements({
    seed: (doc) => {
      doc.measurements.push(
        measurement({ id: 'msr_2', value: 2, takenAt: '2026-11-10T10:00:00.1Z' }),
        measurement({ id: 'msr_6', value: 6, takenAt: '2026-11-10T10:00:04.000Z' }),
        measurement({ id: 'msr_1', value: 1, takenAt: '2026-11-10T10:00:00.000Z' }),
        measurement({ id: 'msr_4', value: 4, takenAt: '2026-11-10T10:00:02.000Z' }),
        measurement({ id: 'msr_3', value: 3, takenAt: '2026-11-10T10:00:00.19Z' }),
        measurement({ id: 'msr_5', value: 5, takenAt: '2026-11-10T10:00:03.000Z' }),
        measurement({ id: 'msr_7', value: 7, takenAt: '2026-11-10T10:00:05.000Z' }),
      );
    },
  });
  clickBlank();
  selectPin();

  expect(
    readings(7)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['7 V · U1.1', '6 V · U1.1', '5 V · U1.1', '4 V · U1.1', '3 V · U1.1']);
});

test('pin_measurements_show_empty_state_for_pin_without_readings', () => {
  const { clickBlank } = mountMeasurements({
    seed: (doc) => doc.measurements.push(measurement()),
  });
  clickBlank();
  selectPin('3');

  const section = readings(0);
  expect(section.getByText('Selle jalaga mõõtmisi pole.')).toBeTruthy();
  expect(section.queryByRole('list')).toBeNull();
});

test('pin_measurements_require_existing_selected_component_and_pin', () => {
  const { clickBlank } = mountMeasurements({
    seed: (doc) => doc.measurements.push(measurement()),
  });
  clickBlank();
  for (const [id, componentId] of [
    ['1', 'cmp_missing'],
    ['missing', 'cmp_u1'],
  ]) {
    selectPin(id, componentId);
    expect(screen.queryByRole('region', { name: /^Mõõtmised/ })).toBeNull();
  }
  act(() => {
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_u1' }] });
  });
  expect(screen.queryByRole('region', { name: /^Mõõtmised/ })).toBeNull();
});
