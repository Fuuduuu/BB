// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef, pointer } from '../../measurements/__tests__/workspace';
import { useMeasureStore } from '../../measurements/ui/measure-store';

function menu() {
  return screen.getByRole('menu', { name: 'Toimingud' });
}

function entries() {
  return within(menu()).getAllByRole('menuitem');
}

function open(svg: SVGSVGElement, x = 160, y = 100) {
  expect(fireEvent.contextMenu(svg, { button: 2, clientX: x, clientY: y })).toBe(false);
}

function undo(svg: SVGSVGElement) {
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
}

test('context_menu_items_run_same_commands_as_keys', () => {
  const app = mountMeasurements();
  const { engine, registry, svg } = app;
  const read = () => engine.snapshot().doc.components;
  const original = read();
  open(svg);
  const componentEntries = entries();
  expect(
    componentEntries.map((entry) => [entry.textContent, entry.getAttribute('aria-keyshortcuts')]),
  ).toEqual([
    ['Pööra +90°R', 'R'],
    ['Pööra −90°Shift+R', 'Shift+R'],
    ['Teisele pooleleF', 'F'],
    ['Eemalda paigutus plaadilt', null],
  ]);

  const keyboard = registry.keys();
  for (const item of [...registry.contextMenu('component'), ...registry.contextMenu('pin')]) {
    const { shortcut } = item;
    if (!shortcut) continue;
    const key = keyboard.find(
      (binding) =>
        binding.key === shortcut.key && (binding.shift ?? false) === (shortcut.shift ?? false),
    );
    expect(item.run).toBe(key?.run);
  }

  fireEvent.click(componentEntries[0]!);
  const rotated = read();
  expect(rotated[0]?.board?.rotationDeg).toBe(90);
  undo(svg);
  expect(read()).toEqual(original);
  fireEvent.keyDown(svg, { key: 'r' });
  expect(read()).toEqual(rotated);
  undo(svg);

  open(svg);
  fireEvent.click(within(menu()).getByRole('menuitem', { name: /Teisele poolele/ }));
  const flipped = read();
  expect(flipped[0]?.board?.side).toBe('bottom');
  undo(svg);
  fireEvent.keyDown(svg, { key: 'f' });
  expect(read()).toEqual(flipped);
  undo(svg);

  const pin = app.pinPoint('3');
  open(svg, pin.x, pin.y);
  expect(entries().map((entry) => entry.textContent)).toEqual([
    'MõõdaM',
    'Nimeta jalg',
    'Märgi NC-ks',
  ]);
  act(() => useMeasureStore.getState().reset());
  fireEvent.click(within(menu()).getByRole('menuitem', { name: /Mõõda/ }));
  const measured = useMeasureStore.getState();
  expect(measured.measureAt).toEqual(pinRef('3'));
  expect(measured.focusTick).toBe(1);
  act(() => useMeasureStore.getState().reset());
  fireEvent.keyDown(svg, { key: 'm' });
  expect(useMeasureStore.getState().measureAt).toEqual(measured.measureAt);
  expect(useMeasureStore.getState().focusTick).toBe(measured.focusTick);

  open(svg, pin.x, pin.y);
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Märgi NC-ks' }));
  expect(read()[0]?.pins[2]?.nc).toBe(true);
  open(svg, pin.x, pin.y);
  expect(within(menu()).getByRole('menuitem', { name: 'Eemalda NC-märge' })).toBeTruthy();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  undo(svg);
  expect(read()[0]?.pins[2]?.nc).toBe(false);
  act(() => useViewStore.getState().setContextOpen(false));
  open(svg, pin.x, pin.y);
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Nimeta jalg' }));
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Jala 3 nimi' }));
  open(svg, pin.x, pin.y);
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Nimeta jalg' }));
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Jala 3 nimi' }));
});

test('escape_closes_menu_without_change', () => {
  const { svg, engine } = mountMeasurements();
  open(svg);
  const before = engine.snapshot();
  const selected = useSessionStore.getState().selection;
  const navigatorOpen = useViewStore.getState().navigatorOpen;
  fireEvent.keyDown(document.activeElement!, { key: 'r' });
  fireEvent.keyDown(document.activeElement!, { key: 'n' });
  fireEvent.keyDown(document.activeElement!, { key: 'Enter', ctrlKey: true });
  expect(entries()).toHaveLength(4);
  expect(engine.snapshot()).toBe(before);
  expect(useViewStore.getState().navigatorOpen).toBe(navigatorOpen);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(engine.snapshot()).toBe(before);
  expect(useSessionStore.getState()).toMatchObject({ selection: selected, toolId: 'select' });
  expect(document.activeElement).toBe(svg);
  open(svg);
  pointer(svg, 'pointerdown', 460, 260);
  pointer(svg, 'pointerup', 460, 260);
  expect(screen.queryByRole('menu')).toBeNull();
  expect(engine.snapshot()).toBe(before);
  expect(useSessionStore.getState()).toMatchObject({ selection: selected, toolId: 'select' });
  expect(document.activeElement).toBe(svg);
});

test('shift_f10_opens_menu_for_selection', () => {
  const { svg, engine } = mountMeasurements();
  act(() =>
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_u1' }] }),
  );
  svg.focus();
  fireEvent.keyDown(svg, { key: 'F10', shiftKey: true });
  expect(document.activeElement).toBe(entries()[0]);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
  expect(document.activeElement).toBe(entries().at(-1));
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(entries()[0]);
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(document.activeElement).toBe(entries().at(-1));
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(document.activeElement).toBe(entries()[0]);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(entries()[1]);
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(270);

  fireEvent.keyDown(svg, { key: 'ContextMenu' });
  const opened = menu();
  fireEvent.contextMenu(svg, { button: 0, clientX: 0, clientY: 0 });
  expect(screen.getAllByRole('menu')).toEqual([opened]);
  expect(entries()).toHaveLength(4);
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
  expect(screen.queryByRole('menu')).toBeNull();

  act(() => useSessionStore.getState().setSelection({ items: [] }));
  fireEvent.keyDown(svg, { key: 'F10', shiftKey: true });
  expect(entries().map((entry) => entry.textContent)).toEqual(['Lisa komponent siia']);
});

test('empty_area_menu_places_component_here', () => {
  const { svg, engine } = mountMeasurements();
  act(() => useViewStore.getState().setNavigatorOpen(false));
  open(svg, 420, 250);
  expect(entries().map((entry) => entry.textContent)).toEqual(['Lisa komponent siia']);
  fireEvent.click(entries()[0]!);
  const library = within(screen.getByRole('tabpanel', { name: 'Teek' }));
  const search = library.getByRole('searchbox', { name: 'Otsi korpust' });
  expect(document.activeElement).toBe(search);
  fireEvent.change(search, { target: { value: 'Takisti SMD' } });
  fireEvent.click(library.getByRole('button', { name: 'Takisti SMD' }));
  fireEvent.click(library.getByRole('button', { name: 'Paiguta siia' }));
  expect(engine.snapshot().doc.components.at(-1)?.board?.center).toEqual({ x: 420, y: 250 });
  expect(engine.snapshot().doc.components).toHaveLength(2);
  expect(useSessionStore.getState().toolId).toBe('select');
  undo(svg);
  expect(engine.snapshot().doc.components).toHaveLength(1);
  expect(library.getByRole('button', { name: 'Paiguta' })).toBeTruthy();

  open(svg, 430, 260);
  fireEvent.click(entries()[0]!);
  fireEvent.click(library.getByRole('button', { name: 'Loobu' }));
  expect(engine.snapshot().doc.components).toHaveLength(1);
  expect(library.getByRole('button', { name: 'Paiguta' })).toBeTruthy();
});

test('right_click_keeps_selected_components_and_skips_the_menu_during_tools_and_gestures', () => {
  const { svg, engine, host } = mountMeasurements({
    seed(doc) {
      const next = structuredClone(doc.components[0]!);
      next.id = 'cmp_u2';
      next.ref = 'U2';
      next.board!.center = { x: 320, y: 100 };
      for (const pin of next.pins) pin.uid = `pin_u2_${pin.id}`;
      doc.components.push(next);
    },
  });
  const selected = {
    items: [
      { kind: 'component', id: 'cmp_u1' },
      { kind: 'component', id: 'cmp_u2' },
    ],
  };
  act(() => useSessionStore.getState().setSelection(selected));
  open(svg);
  expect(useSessionStore.getState().selection).toEqual(selected);
  fireEvent.keyDown(document.activeElement!, { key: ' ' });
  expect(engine.snapshot().doc.components.map(({ board }) => board?.rotationDeg)).toEqual([90, 90]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'components.rotate',
    'components.rotate',
  ]);

  fireEvent.keyDown(svg, { key: 'h' });
  open(svg);
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.keyDown(svg, { key: 'v' });
  pointer(svg, 'pointerdown', 400, 250);
  open(svg);
  expect(screen.queryByRole('menu')).toBeNull();
  pointer(svg, 'pointerup', 400, 250);

  open(svg);
  expect(menu()).toBeTruthy();
  fireEvent(window, new Event('blur'));
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(svg);
});

test('pin_menu_uses_the_first_selected_pin_without_changing_the_keyboard_binding', () => {
  const app = mountMeasurements();
  const { svg } = app;
  const selected = {
    items: [
      { kind: 'component', id: 'cmp_u1' },
      { kind: 'pin', id: '3', componentId: 'cmp_u1' },
      { kind: 'pin', id: '2', componentId: 'cmp_u1' },
    ],
  };
  act(() => {
    useMeasureStore.getState().reset();
    useSessionStore.getState().setSelection(selected);
  });
  fireEvent.keyDown(svg, { key: 'm' });
  expect(useMeasureStore.getState().measureAt).toBeNull();

  const second = app.pinPoint('2');
  open(svg, second.x, second.y);
  expect(useSessionStore.getState().selection).toEqual(selected);
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Mõõda' }));
  expect(useMeasureStore.getState().measureAt).toEqual(pinRef('3'));
  expect(useSessionStore.getState().selection).toEqual(selected);

  open(svg, second.x, second.y);
  fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Nimeta jalg' }));
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Jala 3 nimi' }));
});
