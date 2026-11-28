// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { UiRegistry, useSessionStore, useViewStore } from '@pcbk/ui';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { SchematicCanvas } from '../../../ui/src/app/SchematicCanvas';
import { idGenerator, setupWithAllFeatures } from '../../__tests__/helpers';
import { measurementDoc, mountMeasurements } from '../../measurements/__tests__/workspace';
import { uiFeatures } from '../../ui';

test('schematic_keys_and_menu_rotate_mirror_remove', () => {
  const doc = measurementDoc();
  const original = doc.components[0]!;
  const placed = (id: string, ref: string, x: number) => ({
    ...original,
    id,
    ref,
    pins: original.pins.map((pin) => ({ ...pin, uid: `pin_${id}_${pin.id}` })),
    schematic: { symbol: 'box', at: { x, y: 50.8 }, rot: 0 as const, mirror: false },
  });
  doc.components = [placed('cmp_u1', 'U1', 50.8), placed('cmp_u2', 'U2', 76.2)];
  const { engine, host } = setupWithAllFeatures(doc);
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  useViewStore.getState().setActiveView('schematic');
  useViewStore.getState().setSchematicView({ zoom: 1, pan: { x: 0, y: 0 } });
  const registry = new UiRegistry(uiFeatures(idGenerator(), () => {}));
  const { container, unmount } = render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <SchematicCanvas registry={registry} />
    </EngineProvider>,
  );
  const scene = container.querySelector('[data-scene]')!;
  const svg = scene.closest('svg')!;
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
  });
  act(() =>
    useSessionStore.getState().setSelection({
      items: doc.components.map(({ id }) => ({ kind: 'component', id })),
    }),
  );
  const components = () => engine.snapshot().doc.components;
  const commands = () => host.drainJournal().map(({ commandId }) => commandId);
  const assertState = (rot: number, mirror: boolean) => {
    expect(components().map(({ schematic }) => [schematic?.rot, schematic?.mirror])).toEqual([
      [rot, mirror],
      [rot, mirror],
    ]);
    expect(components().map(({ board }) => board)).toEqual(
      doc.components.map(({ board }) => board),
    );
  };
  fireEvent.keyDown(svg, { key: 'r' });
  expect(commands()).toEqual(['schematic.place']);
  assertState(90, false);
  fireEvent.keyDown(svg, { key: 'R', shiftKey: true });
  expect(commands()).toEqual(['schematic.place']);
  assertState(0, false);
  fireEvent.keyDown(svg, { key: 'f' });
  expect(commands()).toEqual(['schematic.place']);
  assertState(0, true);
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  assertState(0, false);
  host.drainJournal();

  fireEvent.contextMenu(svg, { button: 2, clientX: 50.8, clientY: 50.8 });
  const entries = within(screen.getByRole('menu', { name: 'Toimingud' })).getAllByRole('menuitem');
  expect(
    entries.map((entry) => [entry.textContent, entry.getAttribute('aria-keyshortcuts')]),
  ).toEqual([
    ['Pööra +90°R', 'R'],
    ['Pööra −90°Shift+R', 'Shift+R'],
    ['PeegeldaF', 'F'],
    ['Eemalda skeemilt', null],
    ['Näita plaadil', null],
  ]);
  fireEvent.click(entries[3]!);
  expect(commands()).toEqual(['schematic.remove']);
  expect(components().map(({ id, schematic }) => [id, schematic])).toEqual([
    ['cmp_u1', undefined],
    ['cmp_u2', undefined],
  ]);
  expect(components().map(({ board }) => board)).toEqual(doc.components.map(({ board }) => board));

  unmount();
  useViewStore.getState().setActiveView('board');
  const board = mountMeasurements({ seed: (seeded) => (seeded.components = doc.components) });
  act(() =>
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_u1' }] }),
  );
  fireEvent.keyDown(board.svg, { key: 'r' });
  const rotated = board.engine.snapshot().doc.components[0]!;
  expect(rotated.board?.rotationDeg).toBe(90);
  expect(rotated.schematic).toEqual(doc.components[0]!.schematic);
});
