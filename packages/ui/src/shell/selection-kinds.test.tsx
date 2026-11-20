// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { AppShell } from './AppShell';
import { useSessionStore } from './session-store';
import { UiRegistry } from './UiRegistry';
import { useViewStore } from './view-store';

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
  useViewStore.getState().reset();
});

function mount(engine: FakeEngine, registry: UiRegistry) {
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell
        registry={registry}
        onRetrySave={vi.fn()}
        onSaveElsewhere={vi.fn()}
        onCopyAndReload={vi.fn()}
        onExportDiagnostics={vi.fn()}
      />
    </EngineProvider>,
  );
}

test('selection_validity_comes_from_registry', () => {
  const registry = new UiRegistry([
    {
      id: 'fixture',
      title: 'Proov',
      selectionKinds: [
        {
          kind: 'fixture',
          label: (_snapshot, item) => item.id,
          exists: (current, item) => current.rev === 0 || item.id !== 'gone',
          moveRef: (_snapshot, item) =>
            item.id === 'fixed' ? null : { kind: 'component', id: item.id },
        },
        { kind: 'pin', label: () => null, exists: () => true },
      ],
    },
  ]);
  const engine = new FakeEngine(snapshot('session-a', 0));
  const unknown = { kind: 'unregistered', id: 'unknown' };
  const selected = { items: [{ kind: 'fixture', id: 'gone' }, unknown] };
  mount(engine, registry);
  act(() => useSessionStore.getState().setSelection(selected));
  expect(useSessionStore.getState().selection).toEqual(selected);
  act(() => engine.replace(snapshot('session-a', 1)));
  expect(useSessionStore.getState().selection).toEqual({ items: [unknown] });

  const current = engine.snapshot();
  const valid = { items: [{ kind: 'fixture', id: 'kept' }, unknown] };
  expect(registry.validSelection(current, valid)).toBe(valid);
  expect(
    registry.moveRefs(current, [
      { kind: 'fixture', id: 'first' },
      { kind: 'fixture', id: 'fixed' },
      { kind: 'pin', id: '1' },
      unknown,
      { kind: 'fixture', id: 'kept' },
      { kind: 'fixture', id: 'first' },
    ]),
  ).toEqual([
    { kind: 'component', id: 'first' },
    { kind: 'component', id: 'kept' },
  ]);
  expect(() =>
    registry.register({
      id: 'duplicate-kind',
      title: 'Kordus',
      selectionKinds: [{ kind: 'pin', label: () => null, exists: () => true }],
    }),
  ).toThrow('Duplicate selectionKinds id: pin');
});

test('shell_and_select_tool_have_no_component_kind', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const forbidden = /['"](?:component|pin)['"]|\bcomponents\b|\bunplaced\w*/;
  for (const relative of ['./AppShell.tsx', '../canvas/SelectTool.ts']) {
    expect(readFileSync(resolve(here, relative), 'utf8'), relative).not.toMatch(forbidden);
  }
  const contract = resolve(here, '../../../contracts/src/snapshot.ts');
  expect(readFileSync(contract, 'utf8')).not.toContain('unplaced');
});

test('selection_cleared_when_selected_item_disappears', () => {
  const initial = snapshot();
  const engine = new FakeEngine({
    ...initial,
    doc: {
      ...initial.doc,
      components: [
        {
          id: 'cmp_present',
          ref: 'R1',
          kind: 'resistor',
          marking: '',
          value: '',
          identified: false,
          dnp: false,
          note: '',
          pins: [],
        },
      ],
    },
  });
  mount(
    engine,
    new UiRegistry([
      {
        id: 'component-fixture',
        title: 'Komponendi proov',
        selectionKinds: [
          {
            kind: 'component',
            label: () => null,
            exists: (current, item) => current.doc.components.some(({ id }) => id === item.id),
          },
        ],
      },
    ]),
  );
  act(() =>
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_present' }] }),
  );
  act(() => engine.replace(snapshot('session-a', 1)));
  expect(useSessionStore.getState().selection).toEqual({ items: [] });
});
