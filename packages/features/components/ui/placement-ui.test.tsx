// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { EngineProvider, useSnapshot } from '@pcbk/client';
import { AppShell, Canvas, UiRegistry, useSessionStore, useViewStore } from '@pcbk/ui';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import type { AddComponentParams } from '../contract';
import { idGenerator, setup } from '../../__tests__/helpers';
import { createComponentsUi } from './index';

const view = { zoom: 1, pan: { x: 0, y: 0 } };
const board = { footprint: 'chip', center: { x: 100, y: 100 } };

function component(id: string, ref: string, placed = true): AddComponentParams {
  return {
    id,
    ref,
    kind: 'resistor',
    pins: [
      { id: '1', uid: `pin_${id}_1` },
      { id: '2', uid: `pin_${id}_2` },
    ],
    board: placed ? board : undefined,
  };
}

function mount(components: AddComponentParams[] = [component('cmp_a', 'R1')]) {
  const { engine, host } = setup();
  for (const params of components) expect(engine.execute('components.add', params).ok).toBe(true);
  host.drainJournal();
  const registry = new UiRegistry([createComponentsUi(idGenerator())]);
  const layers = registry.canvasLayers();
  const tools = registry.tools();
  const keys = registry.keys();
  const noop = () => {};
  function Board() {
    const snapshot = useSnapshot((value) => value);
    return (
      <Canvas
        layers={layers}
        tools={tools}
        keys={keys}
        sceneTransform="none"
        view={view}
        onViewChange={noop}
        snapshot={snapshot}
        execute={engine.execute}
      />
    );
  }
  const mounted = render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell
        registry={registry}
        canvas={<Board />}
        onRetrySave={noop}
        onSaveElsewhere={noop}
        onCopyAndReload={noop}
        onExportDiagnostics={noop}
      />
    </EngineProvider>,
  );
  return { engine, host, canvas: mounted.container.querySelector('[data-view]')!.closest('svg')! };
}

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
  useViewStore.getState().reset();
});

function select(ref: string) {
  fireEvent.click(screen.getByRole('button', { name: `Vali ${ref}` }));
}

test('old_navigator_tab_components_opens_placed_list', () => {
  useViewStore.getState().setNavigatorTab('components');
  mount([component('cmp_a', 'R10'), component('cmp_b', 'R2'), component('cmp_c', 'R3', false)]);
  expect(screen.getByRole('tab', { name: 'Plaadil', selected: true }).id).toBe(
    'pcbk-tab-components',
  );
  const pane = screen.getByRole('tabpanel', { name: 'Plaadil' });
  expect(
    within(pane)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')),
  ).toEqual(['Vali R2', 'Vali R10']);
  expect(screen.getByRole('tab', { name: 'Plaadile paigutamata (1)' })).toBeTruthy();
});

test('rotate_and_flip_keys_dispatch_commands', () => {
  const { canvas, engine, host } = mount();
  select('R1');
  fireEvent.keyDown(canvas, { key: 'r' });
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(90);
  fireEvent.keyDown(canvas, { key: 'R', shiftKey: true });
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(0);
  fireEvent.keyDown(canvas, { key: 'f' });
  expect(engine.snapshot().doc.components[0]?.board?.side).toBe('bottom');
  expect(host.drainJournal().map((row) => row.commandId)).toEqual([
    'components.rotate',
    'components.rotate',
    'components.flipSide',
  ]);
});

test('held_rotate_key_rotates_once', () => {
  const { canvas, engine, host } = mount();
  select('R1');
  expect(fireEvent.keyDown(canvas, { key: 'r' })).toBe(false);
  expect(fireEvent.keyDown(canvas, { key: 'r', repeat: true })).toBe(false);
  expect(fireEvent.keyDown(canvas, { key: 'r', repeat: true })).toBe(false);
  fireEvent.keyUp(canvas, { key: 'r' });
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(90);
  expect(host.drainJournal().map((row) => row.commandId)).toEqual(['components.rotate']);
});

test('placement_section_buttons_dispatch_commands', () => {
  const { engine, host } = mount();
  select('R1');
  expect(screen.getByRole('heading', { name: 'Korpus ja asend' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Pööra +90°' }));
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(90);
  fireEvent.click(screen.getByRole('button', { name: 'Pööra −90°' }));
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Teisele poolele' }));
  expect(engine.snapshot().doc.components[0]?.board?.side).toBe('bottom');
  expect(host.drainJournal().map((row) => row.commandId)).toEqual([
    'components.rotate',
    'components.rotate',
    'components.flipSide',
  ]);
});

test('remove_from_board_moves_component_to_unplaced', () => {
  const { engine, host } = mount();
  const original = engine.snapshot().doc.components[0]!;
  select('R1');
  fireEvent.click(screen.getByRole('button', { name: 'Eemalda paigutus plaadilt' }));
  expect(engine.snapshot().doc.components[0]?.board).toBeUndefined();
  expect(engine.snapshot().doc.components[0]?.pins).toEqual(original.pins);
  expect(useSessionStore.getState().selection.items).toEqual([{ kind: 'component', id: 'cmp_a' }]);
  expect(screen.queryByRole('heading', { name: 'Korpus ja asend' })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Plaadile paigutamata (1)' }));
  expect(screen.getByRole('button', { name: 'Vali R1' })).toBeTruthy();
  expect(host.drainJournal().map((row) => row.commandId)).toEqual(['components.removeFromBoard']);
});
