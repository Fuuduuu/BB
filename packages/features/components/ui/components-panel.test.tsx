// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { parseViewState } from '@pcbk/contracts';
import { BoardDocSchema } from '@pcbk/domain';
import { AppShell, UiRegistry, useSessionStore, useViewStore } from '@pcbk/ui';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { idGenerator, setup } from '../../__tests__/helpers';
import { createComponentsUi } from './index';
import { usePlaceStore } from './place-store';

beforeEach(() => {
  useSessionStore.getState().reset('feature-test');
  useViewStore.getState().reset();
  usePlaceStore.getState().reset();
});

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
  useViewStore.getState().reset();
  usePlaceStore.getState().reset();
});

function fixture(placed = 1, unplaced = 1) {
  const result = setup();
  for (let index = 0; index < placed + unplaced; index++) {
    expect(
      result.engine.execute('components.add', {
        id: `cmp_${index}`,
        ref: `R${index + 1}`,
        kind: 'resistor',
        pins: [
          { id: '1', uid: `pin_${index}_1` },
          { id: '2', uid: `pin_${index}_2` },
        ],
        board: index < placed ? { footprint: 'chip', center: { x: 20, y: 20 } } : undefined,
      }).ok,
    ).toBe(true);
  }
  result.host.drainJournal();
  return result;
}

function mount(
  engine = fixture().engine,
  registry = new UiRegistry([createComponentsUi(idGenerator())]),
) {
  const noop = () => {};
  return render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell
        registry={registry}
        onRetrySave={noop}
        onSaveElsewhere={noop}
        onCopyAndReload={noop}
        onExportDiagnostics={noop}
      />
    </EngineProvider>,
  );
}

test('properties_header_shows_selected_ref', () => {
  const { engine } = fixture(0, 0);
  useViewStore.getState().setContextWidth(280);
  expect(
    engine.execute('components.add', {
      id: 'cmp_j29',
      ref: 'J29',
      kind: 'connector',
      pins: [
        { id: '15', uid: 'pin_j29_15' },
        { id: '16', uid: 'pin_j29_16', name: 'GND' },
      ],
    }).ok,
  ).toBe(true);
  mount(
    engine,
    new UiRegistry([
      createComponentsUi(idGenerator()),
      {
        id: 'pinned',
        title: 'Mõõda',
        contextPinned: [{ id: 'measure', order: 0, useVisible: () => true, render: () => null }],
      },
    ]),
  );
  const pane = within(screen.getByRole('complementary', { name: 'Omadused' }));
  const component = { kind: 'component', id: 'cmp_j29' };
  const pin = { kind: 'pin', componentId: 'cmp_j29', id: '15' };
  const namedPin = { ...pin, id: '16' };

  expect(pane.getByText('Omadused')).toBeTruthy();
  act(() => useSessionStore.getState().setSelection({ items: [component] }));
  expect(pane.getByText('Omadused · J29')).toBeTruthy();
  act(() => useSessionStore.getState().setSelection({ items: [pin] }));
  expect(pane.getByText('Omadused · J29.15')).toBeTruthy();
  act(() => useSessionStore.getState().setSelection({ items: [namedPin] }));
  expect(pane.getByText('Omadused · J29.GND').title).toBe('Omadused · J29.GND');
  const longName = 'Pika nimega maandusjalg toiteploki ühendamiseks';
  act(() => {
    expect(
      engine.execute('components.renamePin', {
        id: component.id,
        pinId: namedPin.id,
        name: longName,
      }).ok,
    ).toBe(true);
  });
  const longTitle = `Omadused · J29.${longName}`;
  expect(pane.getByText(longTitle).title).toBe(longTitle);
  expect(pane.getByRole('button', { name: 'Peida omadused' })).toBeTruthy();
  act(() => useSessionStore.getState().setSelection({ items: [component, pin] }));
  expect(pane.getByText('Omadused')).toBeTruthy();
  act(() => useSessionStore.getState().setSelection({ items: [{ kind: 'net', id: 'net_1' }] }));
  expect(pane.getByText('Omadused')).toBeTruthy();
});

test('component_filters_switch_placed_and_unplaced', () => {
  const { engine, host } = fixture();
  const before = engine.snapshot();
  mount(engine);
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Teek', 'Komponendid']);
  const filters = within(screen.getByRole('radiogroup', { name: 'Filter' }));
  const placed = filters.getByRole('radio', { name: 'Plaadil (1)', checked: true });
  const unplaced = filters.getByRole('radio', { name: 'Paigutamata (1)', checked: false });
  expect(placed.tabIndex).toBe(0);
  expect(unplaced.tabIndex).toBe(-1);
  expect(screen.getByRole('button', { name: 'Vali R1' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Vali R2' })).toBeNull();
  expect(unplaced.querySelector('.pcbk-component-filters__dot')?.getAttribute('aria-hidden')).toBe(
    'true',
  );

  fireEvent.click(unplaced);
  expect(filters.getByRole('radio', { name: 'Paigutamata (1)', checked: true })).toBe(unplaced);
  expect(screen.queryByRole('button', { name: 'Vali R1' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Vali R2' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Lisa komponent' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Paiguta plaadile' })).toBeTruthy();
  expect(unplaced.querySelector('.pcbk-component-filters__dot')).toBeNull();
  expect(useViewStore.getState().modules.components).toEqual({ filter: 'unplaced' });

  fireEvent.click(placed);
  expect(filters.getByRole('radio', { name: 'Plaadil (1)', checked: true })).toBe(placed);
  expect(screen.getByRole('button', { name: 'Vali R1' })).toBeTruthy();
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('component_filter_keyboard_moves_focus_selection_and_wraps', () => {
  mount();
  const placed = screen.getByRole('radio', { name: 'Plaadil (1)' });
  const unplaced = screen.getByRole('radio', { name: 'Paigutamata (1)' });
  placed.focus();
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
    fireEvent.keyDown(placed, { key });
    expect(document.activeElement).toBe(unplaced);
    expect(unplaced.getAttribute('aria-checked')).toBe('true');
    expect(unplaced.tabIndex).toBe(0);
    expect(placed.tabIndex).toBe(-1);
    fireEvent.keyDown(unplaced, { key });
    expect(document.activeElement).toBe(placed);
    expect(placed.getAttribute('aria-checked')).toBe('true');
  }
  fireEvent.keyDown(placed, { key: 'End' });
  expect(document.activeElement).toBe(unplaced);
  fireEvent.keyDown(unplaced, { key: 'Home' });
  expect(document.activeElement).toBe(placed);
  fireEvent.keyDown(placed, { key: 'Escape' });
  expect(placed.getAttribute('aria-checked')).toBe('true');
});

test('component_filter_survives_reopen_without_rev', () => {
  const { engine, host } = fixture();
  const before = engine.snapshot();
  const first = mount(engine);
  fireEvent.click(screen.getByRole('radio', { name: 'Paigutamata (1)' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Teek' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Komponendid' }));
  expect(screen.getByRole('radio', { name: 'Paigutamata (1)', checked: true })).toBeTruthy();
  const persisted = JSON.stringify(useViewStore.getState().getView());
  first.unmount();
  useSessionStore.getState().reset('');
  useViewStore.getState().reset();

  const reopened = setup(BoardDocSchema.parse(before.doc));
  useViewStore.getState().restore(parseViewState(JSON.parse(persisted)));
  useSessionStore.getState().reset('feature-test');
  const second = mount(reopened.engine);
  expect(screen.getByRole('radio', { name: 'Paigutamata (1)', checked: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Vali R2' })).toBeTruthy();
  expect(engine.snapshot()).toBe(before);
  expect(reopened.engine.snapshot().rev).toBe(before.rev);
  expect(host.drainJournal()).toEqual([]);
  expect(reopened.host.drainJournal()).toEqual([]);

  second.unmount();
  useViewStore.getState().reset();
  mount(fixture(1, 0).engine);
  expect(screen.getByRole('radio', { name: 'Plaadil (1)', checked: true })).toBeTruthy();
  expect(useViewStore.getState().modules).toEqual({});
});

test.each(
  [
    undefined,
    null,
    false,
    12,
    'unplaced',
    [],
    ['unplaced'],
    {},
    { filter: null },
    { filter: false },
    { filter: ['unplaced'] },
    { filter: 'unknown' },
  ].map((value) => [value]),
)('invalid_component_filter_defaults_to_placed (%j)', (value) => {
  useViewStore.getState().setModuleView('components', value);
  const { engine } = fixture();
  const before = engine.snapshot();
  mount(engine);
  expect(screen.getByRole('radio', { name: 'Plaadil (1)', checked: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Vali R1' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Vali R2' })).toBeNull();
  expect(engine.snapshot()).toBe(before);
});

test.each([
  [0, 0, null],
  [2, 0, '2 plaadil'],
  [0, 3, '3 paigutamata'],
  [1, 2, '1 plaadil · 2 paigutamata'],
] as const)('component_summary_omits_zero_parts (%i/%i)', (placed, unplaced, expected) => {
  const { engine } = fixture(placed, unplaced);
  const registry = new UiRegistry([createComponentsUi(idGenerator())]);
  const tab = registry.navigatorTabs().find((panel) => panel.id === 'components')!;
  expect(tab.summary?.(engine.snapshot())).toBe(expected);
  expect(registry.navigatorTabs().find((panel) => panel.id === 'library')?.summary).toBeUndefined();
});

test('adding_unplaced_component_keeps_placed_filter_and_updates_hint', () => {
  const { engine } = fixture(1, 0);
  mount(engine);
  const unplaced = screen.getByRole('radio', { name: 'Paigutamata (0)' });
  expect(unplaced.querySelector('.pcbk-component-filters__dot')).toBeNull();
  act(() => {
    expect(
      engine.execute('components.add', {
        id: 'cmp_new',
        kind: 'resistor',
        pins: [
          { id: '1', uid: 'pin_new_1' },
          { id: '2', uid: 'pin_new_2' },
        ],
      }).ok,
    ).toBe(true);
  });
  expect(screen.getByRole('radio', { name: 'Plaadil (1)', checked: true })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Paigutamata (1)', checked: false })).toBe(unplaced);
  expect(unplaced.querySelector('.pcbk-component-filters__dot')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Vali R2' })).toBeNull();
});
