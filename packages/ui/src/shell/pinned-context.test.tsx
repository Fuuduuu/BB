// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { create } from 'zustand';
import { EngineProvider } from '@pcbk/client';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { AppShell } from './AppShell';
import { UiRegistry } from './UiRegistry';
import { et } from './i18n/et';
import { useSessionStore } from './session-store';
import { useViewStore } from './view-store';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useViewStore.getState().reset();
});

function setup(registry: UiRegistry) {
  const engine = new FakeEngine(snapshot());
  const projects = new FakeProjects();
  const shell = (current: UiRegistry) => (
    <EngineProvider engine={engine} projects={projects}>
      <AppShell
        registry={current}
        onRetrySave={() => {}}
        onSaveElsewhere={() => {}}
        onCopyAndReload={() => {}}
        onExportDiagnostics={() => {}}
      />
    </EngineProvider>
  );
  const { rerender } = render(shell(registry));
  return (current: UiRegistry) => rerender(shell(current));
}

test('visible pinned sections are ordered above selected item sections', () => {
  const useVisible = create(() => ({ first: false, second: false }));
  setup(
    new UiRegistry([
      {
        id: 'pinned',
        title: 'Pinned',
        contextPinned: [
          {
            id: 'second',
            order: 2,
            useVisible: () => useVisible((s) => s.second),
            render: () => 'Teine',
          },
          {
            id: 'first',
            order: 1,
            useVisible: () => useVisible((s) => s.first),
            render: () => 'Esimene',
          },
        ],
        contextSections: [
          { id: 'selected', order: 0, appliesTo: ['net'], render: () => 'Valitud' },
        ],
      },
    ]),
  );
  expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
  act(() => useVisible.setState({ first: true, second: true }));
  const pane = screen.getByRole('complementary', { name: et.shell.context });
  expect(within(pane).queryByText(et.shell.contextEmpty)).toBeNull();
  expect(within(pane).getByText('Esimene')).toBeTruthy();
  act(() => useSessionStore.getState().setSelection({ items: [{ kind: 'net', id: 'net_1' }] }));
  expect(Array.from(pane.querySelectorAll('section'), (section) => section.textContent)).toEqual([
    'Esimene',
    'Teine',
    'Valitud',
  ]);
  act(() => useSessionStore.getState().setSelection({ items: [] }));
  expect(within(pane).getByText('Esimene')).toBeTruthy();
  expect(within(pane).queryByText(et.shell.contextEmpty)).toBeNull();
});

test('the selection prompt stays hidden when a selected kind has no sections', () => {
  setup(new UiRegistry());
  act(() => useSessionStore.getState().setSelection({ items: [{ kind: 'net', id: 'net_1' }] }));
  expect(screen.queryByText(et.shell.contextEmpty)).toBeNull();
});

test.each([true, false])(
  'a newly visible pinned section opens the panel even if another is already visible (wide=%s)',
  (wide) => {
    vi.stubGlobal('matchMedia', () => ({
      matches: wide,
      addEventListener() {},
      removeEventListener() {},
    }));
    const useVisible = create(() => ({ second: false }));
    setup(
      new UiRegistry([
        {
          id: 'pinned',
          title: 'Pinned',
          contextPinned: [
            { id: 'first', order: 1, useVisible: () => true, render: () => 'Esimene' },
            {
              id: 'second',
              order: 2,
              useVisible: () => useVisible((s) => s.second),
              render: () => 'Teine',
            },
          ],
        },
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: et.shell.hideContext }));
    expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
    act(() => useVisible.setState({ second: false }));
    expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
    act(() => useVisible.setState({ second: true }));
    const pane = screen.getByRole('complementary', { name: et.shell.context });
    expect(within(pane).getByText('Teine')).toBeTruthy();
  },
);

test('replacing the registry can change the hooks for a pinned id', () => {
  const withHook = (useVisible: () => boolean, content: string) =>
    new UiRegistry([
      {
        id: 'pinned',
        title: 'Pinned',
        contextPinned: [{ id: 'measure', order: 0, useVisible, render: () => content }],
      },
    ]);
  function useFirstVisible() {
    const [visible] = useState(true);
    return visible;
  }
  const rerender = setup(withHook(useFirstVisible, 'Esimene'));
  rerender(withHook(() => true, 'Teine'));
  expect(screen.getByText('Teine')).toBeTruthy();
});
