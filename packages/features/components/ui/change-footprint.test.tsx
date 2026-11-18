// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { newBoardDoc, type BoardDoc, type Measurement } from '@pcbk/domain';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { idGenerator, setup } from '../../__tests__/helpers';
import { createComponentsUi } from './index';

const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  cleanup();
  for (const name of ['showModal', 'close'] as const) {
    const original = dialogMethods[name];
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[name];
  }
});

function fixture(count = 14): BoardDoc {
  const doc = newBoardDoc('Korpuse vahetuse katse');
  doc.components.push({
    id: 'cmp_ic',
    ref: 'U1',
    kind: 'ic',
    marking: '',
    value: '',
    note: '',
    identified: false,
    dnp: false,
    pins: Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      uid: `pin_old_${i + 1}`,
      nc: false,
    })),
    board: {
      footprint: 'soic',
      params: { pins: count, body: 3.9 },
      center: { x: 10, y: 10 },
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    },
  });
  return doc;
}

function reading(id: string, pin: string, uid = `pin_old_${pin}`, ref?: string): Measurement {
  return {
    id,
    mode: 'voltage',
    at: { c: 'cmp_ic', p: pin, uid },
    ref: ref ? { c: 'cmp_ic', p: ref, uid: `pin_old_${ref}` } : undefined,
    atLabel: `U1.${pin}`,
    refLabel: ref ? `U1.${ref}` : undefined,
    power: 'on',
    source: 'manual',
    value: 3.3,
    takenAt: '2026-11-15T10:00:00.000Z',
  };
}

function mount(doc = fixture(), readOnly = false) {
  const { engine, host } = setup(doc);
  if (readOnly) host.load('feature-test', doc, true);
  const module = createComponentsUi(idGenerator());
  const section = module.contextSections!.find(({ id }) => id === 'component-placement')!;
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      {section.render({ selection: { items: [{ kind: 'component', id: 'cmp_ic' }] } })}
    </EngineProvider>,
  );
  return { engine, host };
}

function edit(pins = '8') {
  const summary = screen.getByText(/Korpus · SOIC · \d+ jalga/);
  fireEvent.click(summary);
  // jsdom does not implement the native details toggle.
  summary.closest('details')!.setAttribute('open', '');
  fireEvent.click(screen.getByRole('button', { name: 'Muuda' }));
  const editor = within(screen.getByRole('region', { name: 'Korpuse valik' }));
  fireEvent.change(editor.getByRole('combobox', { name: 'Jalgu' }), { target: { value: pins } });
  return editor;
}

test('change_to_area_shows_no_impact_dialog', () => {
  const doc = fixture(8);
  doc.components[0]!.pins[2]!.name = 'VCC';
  doc.components[0]!.pins[3]!.nc = true;
  doc.measurements.push(reading('msr_area', '3', undefined, '4'));
  const { engine, host } = mount(doc);
  const before = engine.snapshot();
  const editor = edit();
  fireEvent.change(editor.getByRole('combobox', { name: 'Vali korpus' }), {
    target: { value: 'unknown' },
  });
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  const after = engine.snapshot();
  expect(after.doc.components[0]!.board?.footprint).toBe('area');
  expect(after.doc.components[0]!.pins).toStrictEqual(before.doc.components[0]!.pins);
  expect(after.doc.measurements).toStrictEqual(before.doc.measurements);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'components.changeFootprint',
  ]);
});

test('shrinking_package_confirms_and_lists_lost_pins', () => {
  const doc = fixture();
  doc.components[0]!.pins[8]!.name = 'OUT';
  doc.components[0]!.pins[9]!.nc = true;
  doc.measurements.push(
    reading('msr_at', '12', undefined, '13'),
    reading('msr_ref', '1', undefined, '14'),
    reading('msr_historical', '12', 'pin_previous_12'),
  );
  const { engine, host } = mount(doc);
  const editor = edit();
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Korpuse vahetus' }));
  expect(
    dialog.getByText(
      'Kaovad jalad 9–14: 2 mõõtmist, 1 nimi, 1 NC-märge. Mõõtmised jäävad ajaloolistena alles.',
    ),
  ).toBeTruthy();
  expect(engine.snapshot().doc.components[0]!.pins).toHaveLength(14);
  expect(host.drainJournal()).toHaveLength(0);
  fireEvent.click(dialog.getByRole('button', { name: 'Vaheta korpus' }));
  expect(engine.snapshot().doc.components[0]!.pins).toHaveLength(8);
  expect(engine.snapshot().doc.measurements).toHaveLength(3);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'components.changeFootprint',
  ]);
});

test('change_without_impact_runs_without_dialog', () => {
  const { engine, host } = mount(fixture(8));
  const editor = edit('14');
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(engine.snapshot().doc.components[0]!.pins.map(({ uid }) => uid)).toEqual([
    'pin_old_1',
    'pin_old_2',
    'pin_old_3',
    'pin_old_4',
    'pin_old_5',
    'pin_old_6',
    'pin_old_7',
    'pin_old_8',
    'pin_1',
    'pin_2',
    'pin_3',
    'pin_4',
    'pin_5',
    'pin_6',
  ]);
  expect(host.drainJournal()).toHaveLength(1);
});

test('change_footprint_does_not_warn_that_a_retained_own_pin_will_be_lost', () => {
  const doc = fixture(8);
  const component = doc.components[0]!;
  const pin = { id: 'EP', uid: 'pin_old_EP', name: 'Jahutus', nc: false };
  const pad = { local: { x: 0, y: 1 }, sizeMm: 0.6, shape: 'circle', through: false } as const;
  component.pins.push(pin);
  component.board!.customPads.EP = pad;
  doc.measurements.push(reading('msr_own', 'EP'));
  const { engine } = mount(doc);
  const editor = edit('14');
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));

  expect(screen.queryByRole('dialog')).toBeNull();
  const after = engine.snapshot().doc.components[0]!;
  expect(after.pins.at(-1)).toEqual(pin);
  expect(after.board?.customPads.EP).toEqual(pad);
  expect(after.board?.params.pins).toBe(14);
});

test('shrinking_ignores_historical_uid_matches_and_blank_names', () => {
  const doc = fixture();
  doc.components[0]!.pins[8]!.name = '   ';
  doc.measurements.push(reading('msr_old', '12', 'pin_previous_12'));
  const { engine } = mount(doc);
  const editor = edit();
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(engine.snapshot().doc.components[0]!.pins).toHaveLength(8);
  expect(engine.snapshot().doc.measurements[0]!.at.uid).toBe('pin_previous_12');
});

test('confirmation_keeps_fixed_pad_ids_readable_and_plural_counts', () => {
  const doc = fixture();
  Object.assign(doc.components[0]!.pins[8]!, { id: 'S1', name: 'Shield', nc: true });
  Object.assign(doc.components[0]!.pins[9]!, { id: 'MP1', name: 'Mount', nc: true });
  mount(doc);
  const editor = edit();
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  expect(screen.getByText('Kaovad jalad 11–14, S1, MP1: 2 nime, 2 NC-märget.')).toBeTruthy();
});

test('canceling_impact_keeps_document_and_editor_draft', () => {
  const doc = fixture();
  doc.components[0]!.pins[8]!.name = 'OUT';
  const { engine, host } = mount(doc);
  const editor = edit();
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Kaovad jalad 9–14: 1 nimi.')).toBeTruthy();
  fireEvent.click(dialog.getByRole('button', { name: 'Loobu' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect((editor.getByRole('combobox', { name: 'Jalgu' }) as HTMLSelectElement).value).toBe('8');
  expect(engine.snapshot().doc.components[0]!.pins).toHaveLength(14);
  expect(host.drainJournal()).toHaveLength(0);
});

test('confirmation_requires_review_again_when_lost_pin_impact_changes', () => {
  const doc = fixture();
  doc.components[0]!.pins[8]!.name = 'OUT';
  const { engine, host } = mount(doc);
  const editor = edit();
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  act(() => {
    expect(engine.execute('components.setNc', { id: 'cmp_ic', pinId: '10', nc: true }).ok).toBe(
      true,
    );
  });
  host.drainJournal();
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Vaheta korpus' }),
  );
  expect(engine.snapshot().doc.components[0]!.pins).toHaveLength(14);
  expect(screen.getByText('Kaovad jalad 9–14: 1 nimi, 1 NC-märge.')).toBeTruthy();
  expect(host.drainJournal()).toHaveLength(0);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Vaheta korpus' }),
  );
  expect(engine.snapshot().doc.components[0]!.pins).toHaveLength(8);
});

test('editor_offers_all_groups_preserves_kind_and_rejects_invalid_numeric_draft', () => {
  const { engine } = mount(fixture(8));
  const editor = edit();
  const choices = editor.getByRole('combobox', { name: 'Vali korpus' });
  expect(within(choices).getAllByRole('option')).toHaveLength(41);
  expect(
    within(choices)
      .getAllByRole<HTMLOptGroupElement>('group')
      .map(({ label }) => label),
  ).toEqual(['Passiivsed', 'Pooljuhid', 'Mikroskeemid', 'Konnektorid', 'Muud', 'Punktid plaadil']);
  fireEvent.change(choices, { target: { value: 'qfp' } });
  const body = editor.getByLabelText<HTMLInputElement>('Kere (mm, 0 = auto)');
  fireEvent.change(body, { target: { value: '-' } });
  expect(body.value).toBe('-');
  expect(editor.queryByRole('img')).toBeNull();
  expect(
    (editor.getByRole('button', { name: 'Vaheta korpus' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(choices, { target: { value: 'tp' } });
  expect(editor.getByRole('img', { name: 'Pealtvaade: Testpunkt, 1 jalg' })).toBeTruthy();
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  expect(engine.snapshot().doc.components[0]).toMatchObject({
    kind: 'ic',
    board: { footprint: 'point' },
  });
});

test('ic_changed_to_hole_reopens_hole_and_keeps_diameter_editable', () => {
  const { engine } = mount(fixture(8));
  const editor = edit();
  fireEvent.change(editor.getByRole('combobox', { name: 'Vali korpus' }), {
    target: { value: 'hole' },
  });
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  expect(engine.snapshot().doc.components[0]).toMatchObject({
    kind: 'ic',
    board: { footprint: 'point', params: { type: 'hole', D: 3.2 } },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Muuda' }));
  const reopened = within(screen.getByRole('region', { name: 'Korpuse valik' }));
  expect((reopened.getByRole('combobox', { name: 'Vali korpus' }) as HTMLSelectElement).value).toBe(
    'hole',
  );
  fireEvent.change(reopened.getByRole('combobox', { name: 'Ava' }), { target: { value: '4.3' } });
  expect(reopened.getByRole('img', { name: 'Pealtvaade: Kinnitusava, 1 jalg' })).toBeTruthy();
  fireEvent.click(reopened.getByRole('button', { name: 'Vaheta korpus' }));
  expect(engine.snapshot().doc.components[0]!.board!.params.D).toBe(4.3);
});

test.each(['tp', 'via', 'pad', 'wire'])(
  'ic_changed_to_%s_reopens_the_same_point_variant',
  (entryId) => {
    const { engine } = mount(fixture(8));
    const editor = edit();
    fireEvent.change(editor.getByRole('combobox', { name: 'Vali korpus' }), {
      target: { value: entryId },
    });
    fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
    expect(engine.snapshot().doc.components[0]!.kind).toBe('ic');
    fireEvent.click(screen.getByRole('button', { name: 'Muuda' }));
    const reopened = within(screen.getByRole('region', { name: 'Korpuse valik' }));
    expect(
      (reopened.getByRole('combobox', { name: 'Vali korpus' }) as HTMLSelectElement).value,
    ).toBe(entryId);
  },
);

test.each([
  {
    entryId: 'r_tht',
    kind: 'diode' as const,
    params: { pitch: '7.62', bl: '6.3', bd: '2.5', band: 'ei' },
  },
  {
    entryId: 'd_tht',
    kind: 'resistor' as const,
    params: { pitch: '10.16', bl: '5.2', bd: '2.7', band: 'jah' },
  },
])(
  'axial_variant_reopens_by_physical_parameters_before_component_kind_%j',
  ({ entryId, kind, params }) => {
    const doc = fixture(8);
    doc.components[0]!.kind = kind;
    const { engine } = mount(doc);
    const editor = edit();
    fireEvent.change(editor.getByRole('combobox', { name: 'Vali korpus' }), {
      target: { value: entryId },
    });
    fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
    act(() => {
      expect(
        engine.execute('components.changeFootprint', {
          id: 'cmp_ic',
          footprint: 'axial',
          params,
          newPinUids: {},
        }).ok,
      ).toBe(true);
    });
    expect(engine.snapshot().doc.components[0]!.kind).toBe(kind);
    fireEvent.click(screen.getByRole('button', { name: 'Muuda' }));
    const reopened = within(screen.getByRole('region', { name: 'Korpuse valik' }));
    expect(
      (reopened.getByRole('combobox', { name: 'Vali korpus' }) as HTMLSelectElement).value,
    ).toBe(entryId);
    expect(reopened.getByRole('img')).toBeTruthy();
  },
);

test('failed_change_shows_error_and_allows_retry', () => {
  const { engine, host } = mount(fixture(8), true);
  const editor = edit('14');
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  expect(editor.getByRole('alert').textContent).toBe('Projekt on kirjutuskaitstud.');
  expect((editor.getByRole('combobox', { name: 'Jalgu' }) as HTMLSelectElement).value).toBe('14');
  // A fresh snapshot may contain pins that were absent during the failed attempt.
  act(() => host.load('feature-test', fixture(10), false));
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  expect(engine.snapshot().doc.components[0]!.pins.map(({ uid }) => uid)).toEqual([
    'pin_old_1',
    'pin_old_2',
    'pin_old_3',
    'pin_old_4',
    'pin_old_5',
    'pin_old_6',
    'pin_old_7',
    'pin_old_8',
    'pin_old_9',
    'pin_old_10',
    'pin_7',
    'pin_8',
    'pin_9',
    'pin_10',
  ]);
});
