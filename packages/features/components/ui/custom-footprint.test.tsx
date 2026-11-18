// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Snapshot } from '@pcbk/contracts';
import { boardPads } from '@pcbk/domain/geometry';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../../measurements/__tests__/workspace';

function mountBoard() {
  const app = mountMeasurements({
    seed(doc) {
      doc.components = [];
    },
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Teek' }));
  const library = within(screen.getByRole('tabpanel', { name: 'Teek' }));
  fireEvent.change(library.getByRole('searchbox', { name: 'Otsi korpust' }), {
    target: { value: 'Kohandatud' },
  });
  fireEvent.click(library.getByRole('button', { name: 'Kohandatud' }));
  return { app, library };
}

function clickBoard(svg: SVGSVGElement, x: number, y: number) {
  pointer(svg, 'pointerdown', x, y);
  pointer(svg, 'pointerup', x, y);
}

function place({ app, library }: ReturnType<typeof mountBoard>) {
  fireEvent.click(library.getByRole('button', { name: 'Paiguta' }));
  clickBoard(app.svg, 180, 150);
  fireEvent.keyDown(window, { key: 'Escape' });
}

function editCustomFootprint(componentId: string) {
  act(() =>
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: componentId }] }),
  );
  // jsdom does not implement the native details toggle.
  screen
    .getByText(/^Korpus · Kohandatud · /)
    .closest('details')!
    .setAttribute('open', '');
  fireEvent.click(screen.getByRole('button', { name: 'Muuda' }));
  return within(screen.getByRole('region', { name: 'Korpuse valik' }));
}

function visiblePads({ doc }: Snapshot) {
  const component = doc.components[0]!;
  return boardPads(
    component.board!,
    component.pins.map(({ id }) => id),
    doc.scale.pxPerMm,
  );
}

test('custom_entry_places_component_with_chosen_layout', () => {
  const board = mountBoard();
  const layout = board.library.getByRole<HTMLSelectElement>('combobox', {
    name: 'Jalgade paigutus',
  });
  expect(Array.from(layout.options, ({ value, text }) => [value, text])).toEqual([
    ['two_rows', '2 rida'],
    ['one_row', '1 rida'],
    ['four_sides', '4 külge'],
    ['empty', 'tühi'],
  ]);
  fireEvent.change(layout, { target: { value: 'four_sides' } });
  fireEvent.change(board.library.getByLabelText('Jalgu'), { target: { value: '12' } });
  fireEvent.change(board.library.getByLabelText('Samm (mm)'), { target: { value: '1,27' } });
  expect(board.library.getByRole('img', { name: 'Pealtvaade: Kohandatud, 12 jalga' })).toBeTruthy();
  place(board);

  const snapshot = board.app.engine.snapshot();
  const component = snapshot.doc.components[0]!;
  expect(component).toMatchObject({
    ref: 'U1',
    kind: 'ic',
    board: { footprint: 'custom', params: { layout: 'four_sides', pins: 12, pitch: 1.27 } },
  });
  expect(component.pins).toHaveLength(12);
  expect(visiblePads(snapshot)).toHaveLength(12);
});

test('custom_layout_change_keeps_pins_and_measurements', () => {
  const board = mountBoard();
  place(board);
  const { engine } = board.app;
  const initial = engine.snapshot().doc.components[0]!;
  expect(initial.board?.params).toMatchObject({ layout: 'two_rows', pins: 8 });
  const pin = initial.pins[2]!;
  act(() => {
    expect(
      engine.execute('measurements.add', {
        id: 'msr_custom',
        mode: 'voltage',
        at: { c: initial.id, p: pin.id, uid: pin.uid },
        value: 3.3,
        power: 'on',
        takenAt: '2026-11-18T08:00:00.000Z',
      }).ok,
    ).toBe(true);
  });

  const editor = editCustomFootprint(initial.id);
  fireEvent.change(editor.getByRole('combobox', { name: 'Jalgade paigutus' }), {
    target: { value: 'four_sides' },
  });
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  const changed = engine.snapshot();
  expect(changed.doc.components[0]!.board?.params).toMatchObject({ layout: 'four_sides', pins: 8 });
  expect(changed.doc.components[0]!.pins).toEqual(initial.pins);
  expect(changed.derived.pinReadings[pin.uid]?.measurementId).toBe('msr_custom');

  const resized = editCustomFootprint(initial.id);
  expect(resized.getByRole<HTMLSelectElement>('combobox', { name: 'Jalgade paigutus' }).value).toBe(
    'four_sides',
  );
  fireEvent.change(resized.getByLabelText('Jalgu'), { target: { value: '10' } });
  fireEvent.click(resized.getByRole('button', { name: 'Vaheta korpus' }));
  const grown = engine.snapshot();
  expect(grown.doc.components[0]!.pins.slice(0, 8)).toEqual(initial.pins);
  expect(grown.doc.components[0]!.pins.slice(8).map(({ id }) => id)).toEqual(['9', '10']);
  expect(visiblePads(grown)).toHaveLength(10);

  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  const restored = engine.snapshot();
  expect(restored.doc.components).toEqual(changed.doc.components);
  expect(restored.derived.pinReadings[pin.uid]?.measurementId).toBe('msr_custom');
});

test('custom_empty_layout_takes_own_pins', () => {
  const board = mountBoard();
  fireEvent.change(board.library.getByRole('combobox', { name: 'Jalgade paigutus' }), {
    target: { value: 'empty' },
  });
  expect(board.library.getByRole('img', { name: 'Pealtvaade: Kohandatud' })).toBeTruthy();
  place(board);
  const { engine, svg } = board.app;
  const empty = engine.snapshot();
  const component = empty.doc.components[0]!;
  expect(component.board?.params).toMatchObject({ layout: 'empty', pins: 8 });
  expect(component.pins).toEqual([]);
  expect(visiblePads(empty)).toEqual([]);

  fireEvent.click(screen.getByRole('tab', { name: 'Komponendid' }));
  fireEvent.click(screen.getByRole('button', { name: 'Vali U1' }));
  fireEvent.keyDown(window, { key: 'j' });
  expect(useSessionStore.getState().toolId).toBe('components.addOwnPin');
  clickBoard(svg, 200, 185);
  const withOwn = engine.snapshot();
  const ownPin = withOwn.doc.components[0]!.pins[0]!;
  expect(ownPin.id).toBe('1');
  expect(withOwn.doc.components[0]!.board?.customPads).toHaveProperty('1');
  expect(visiblePads(withOwn)[0]?.at).toEqual({ x: 200, y: 185 });
  fireEvent.keyDown(window, { key: 'Escape' });

  const editor = editCustomFootprint(component.id);
  fireEvent.change(editor.getByRole('combobox', { name: 'Jalgade paigutus' }), {
    target: { value: 'one_row' },
  });
  fireEvent.change(editor.getByLabelText('Jalgu'), { target: { value: '1' } });
  fireEvent.click(editor.getByRole('button', { name: 'Vaheta korpus' }));
  const absorbed = engine.snapshot();
  expect(absorbed.doc.components[0]!.pins).toEqual([ownPin]);
  expect(absorbed.doc.components[0]!.board).toMatchObject({
    params: { layout: 'one_row', pins: 1 },
    customPads: {},
  });
  expect(visiblePads(absorbed)).toHaveLength(1);
});
