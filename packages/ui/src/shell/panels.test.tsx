// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { AppShell } from './AppShell';
import { et } from './i18n/et';
import { useSessionStore } from './session-store';
import { useViewStore } from './view-store';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useViewStore.getState().reset();
});

function setup(initial = snapshot()) {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  const engine = new FakeEngine(initial);
  const result = render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell
        canvas={<input aria-label="Märkus" />}
        onRetrySave={() => {}}
        onSaveElsewhere={() => {}}
        onCopyAndReload={() => {}}
        onExportDiagnostics={() => {}}
      />
    </EngineProvider>,
  );
  return { ...result, engine };
}
function select(id: string) {
  act(() => useSessionStore.getState().setSelection({ items: [{ kind: 'net', id }] }));
}

test('navigator_hides_and_returns_with_same_width', () => {
  setup();
  fireEvent.keyDown(screen.getByRole('separator', { name: et.shell.resizeNavigator }), {
    key: 'ArrowRight',
  });
  const toggle = screen.getByRole('button', { name: 'Peida navigaator' });
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(toggle.getAttribute('aria-controls')).toBe('pcbk-navigator');
  expect(toggle.title).toContain('N');
  fireEvent.click(toggle);
  expect(screen.queryByRole('complementary', { name: et.shell.navigator })).toBeNull();
  expect(screen.queryByRole('separator', { name: et.shell.resizeNavigator })).toBeNull();
  expect(
    document.querySelector<HTMLElement>('.pcbk-app')!.style.getPropertyValue('--navigator-width'),
  ).toBe('0px');
  fireEvent.click(screen.getByRole('button', { name: 'Näita navigaatorit' }));
  expect(screen.getByRole('complementary', { name: et.shell.navigator })).toBeTruthy();
  expect(
    screen.getByRole('separator', { name: et.shell.resizeNavigator }).getAttribute('aria-valuenow'),
  ).toBe('310');
  expect(useViewStore.getState().navigatorWidth).toBe(310);
});

test('context_hidden_without_selection_on_wide_window', () => {
  setup();
  expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
  expect(screen.queryByRole('separator', { name: et.shell.resizeContext })).toBeNull();
  expect(screen.queryByText(et.shell.contextEmpty)).toBeNull();
  expect(useViewStore.getState().contextShown).toBe(false);
});

test('context_overlays_canvas_without_resizing_it', () => {
  setup();
  const canvas = screen.getByRole('main');
  const workspace = canvas.parentElement!;
  const initialColumns = Array.from(workspace.children);
  const width = document
    .querySelector<HTMLElement>('.pcbk-app')!
    .style.getPropertyValue('--navigator-width');
  select('net_1');
  const pane = screen.getByRole('complementary', { name: et.shell.context });
  expect(pane.classList.contains('pcbk-context')).toBe(true);
  expect(pane.parentElement).toBe(workspace);
  expect(screen.getByRole('main')).toBe(canvas);
  expect(Array.from(workspace.children).slice(0, initialColumns.length)).toEqual(initialColumns);
  expect(
    document.querySelector<HTMLElement>('.pcbk-app')!.style.getPropertyValue('--navigator-width'),
  ).toBe(width);
  expect(workspace.getAttribute('data-context-open')).toBeNull();
  expect(useViewStore.getState().contextShown).toBe(true);
});

test('selection_shows_context_and_hide_choice_is_respected', () => {
  const { engine, unmount } = setup();
  act(() => useViewStore.getState().setContextOpen(false));
  select('net_1');
  expect(screen.getByRole('complementary', { name: et.shell.context })).toBeTruthy();
  const hide = screen.getByRole('button', { name: et.shell.hideContext });
  expect(hide.title).toContain('O');
  fireEvent.click(hide);
  act(() => engine.replace(snapshot('session-a', 1)));
  expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
  expect(useViewStore.getState().contextShown).toBe(false);
  select('net_2');
  expect(useViewStore.getState().contextShown).toBe(true);
  act(() => engine.replace(snapshot('session-b')));
  expect(useViewStore.getState().contextShown).toBe(false);
  select('net_3');
  expect(useViewStore.getState().contextShown).toBe(true);
  unmount();
  expect(useViewStore.getState().contextShown).toBe(false);
});

test('n_and_o_keys_toggle_panels_but_not_in_text_field', () => {
  setup();
  select('net_1');
  fireEvent.keyDown(window, { key: 'n' });
  fireEvent.keyDown(window, { key: 'o' });
  expect(screen.queryByRole('complementary', { name: et.shell.navigator })).toBeNull();
  expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
  for (const key of ['n', 'o']) fireEvent.keyDown(screen.getByRole('textbox'), { key });
  expect(useViewStore.getState().navigatorOpen).toBe(false);
  expect(useViewStore.getState().contextOpen).toBe(false);
  fireEvent.keyDown(window, { key: 'N' });
  fireEvent.keyDown(window, { key: 'O' });
  expect(screen.getByRole('complementary', { name: et.shell.navigator })).toBeTruthy();
  expect(screen.getByRole('complementary', { name: et.shell.context })).toBeTruthy();
});

test('same_selection_in_a_new_object_keeps_context_hidden_and_new_targets_reopen_it', () => {
  const initial = snapshot();
  const components = ['cmp_1', 'cmp_2'].map((id) => ({
    id,
    ref: id === 'cmp_1' ? 'R1' : 'R2',
    kind: 'resistor' as const,
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: ['1', '2'].map((pinId) => ({ id: pinId, uid: `${id}_${pinId}`, nc: false })),
  }));
  setup({ ...initial, doc: { ...initial.doc, components } });
  const choose = (kind: string, id: string, componentId?: string) =>
    act(() => useSessionStore.getState().setSelection({ items: [{ kind, id, componentId }] }));
  const hide = () => fireEvent.click(screen.getByRole('button', { name: et.shell.hideContext }));
  choose('component', 'cmp_1');
  hide();
  choose('component', 'cmp_1');
  expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
  expect(useViewStore.getState().contextOpen).toBe(false);
  choose('component', 'cmp_2');
  expect(screen.getByRole('complementary', { name: et.shell.context })).toBeTruthy();
  hide();
  choose('pin', '1', 'cmp_2');
  expect(screen.getByRole('complementary', { name: et.shell.context })).toBeTruthy();
  hide();
  choose('pin', '1', 'cmp_2');
  expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
  choose('pin', '2', 'cmp_2');
  expect(screen.getByRole('complementary', { name: et.shell.context })).toBeTruthy();
  hide();
  choose('pin', '2', 'cmp_1');
  expect(screen.getByRole('complementary', { name: et.shell.context })).toBeTruthy();
  hide();
  act(() => useSessionStore.getState().setSelection({ items: [] }));
  choose('pin', '2', 'cmp_1');
  expect(screen.getByRole('complementary', { name: et.shell.context })).toBeTruthy();
});

test('reordering_the_same_selected_items_preserves_the_hidden_context_choice', () => {
  setup();
  const items = [
    { kind: 'net', id: 'net_1' },
    { kind: 'net', id: 'net_2' },
  ];
  act(() => useSessionStore.getState().setSelection({ items }));
  fireEvent.click(screen.getByRole('button', { name: et.shell.hideContext }));
  act(() => useSessionStore.getState().setSelection({ items: [...items].reverse() }));
  expect(screen.queryByRole('complementary', { name: et.shell.context })).toBeNull();
  expect(useViewStore.getState().contextOpen).toBe(false);
});

test('context_aria_expanded_reports_actual_empty_visible_and_hidden_panel_state', () => {
  setup();
  const toggle = () => screen.getByRole('button', { name: /^(Näita omadusi|Peida omadused)$/ });
  expect(useViewStore.getState().contextOpen).toBe(true);
  expect(toggle().getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle());
  expect(useViewStore.getState().contextOpen).toBe(false);
  expect(toggle().getAttribute('aria-expanded')).toBe('false');
  select('net_1');
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(toggle());
  expect(toggle().getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle());
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
  act(() => useSessionStore.getState().setSelection({ items: [] }));
  expect(useViewStore.getState().contextOpen).toBe(true);
  expect(toggle().getAttribute('aria-expanded')).toBe('false');
});
