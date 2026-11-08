// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EngineProvider, useSnapshot } from '@pcbk/client';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { AppShell } from './AppShell';
import { PanelErrorBoundary, RootErrorBoundary } from './ErrorBoundary';
import { SaveStatus } from './SaveStatus';
import { et } from './i18n/et';
import { useViewStore } from './view-store';
import { useSessionStore } from './session-store';
import { UiRegistry } from './UiRegistry';
import type { Selection } from './session-store';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useViewStore.getState().reset();
});
const actions = () => ({
  onRetrySave: vi.fn(),
  onSaveElsewhere: vi.fn(),
  onCopyAndReload: vi.fn(),
  onExportDiagnostics: vi.fn(),
});
function setup(canvas?: React.ReactNode) {
  const engine = new FakeEngine(snapshot('session-a', 0, 'Minu plaat'));
  const projects = new FakeProjects();
  const callbacks = actions();
  render(
    <EngineProvider engine={engine} projects={projects}>
      <AppShell {...callbacks} canUndo canRedo canvas={canvas} />
    </EngineProvider>,
  );
  return { engine, projects, ...callbacks };
}
function Broken(): never {
  throw new Error('private crash detail');
}
function silenceExpectedCrash() {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const handler = (event: ErrorEvent) => event.preventDefault();
  window.addEventListener('error', handler);
  return () => window.removeEventListener('error', handler);
}
test('panel boundary shows fallback and keeps shell alive', () => {
  const restore = silenceExpectedCrash();
  try {
    setup(<Broken />);
    expect(screen.getByText(et.error.panel)).toBeTruthy();
    expect(screen.getByText('Minu plaat')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: et.shell.navigator })).toBeTruthy();
    expect(screen.queryByText('private crash detail')).toBeNull();
  } finally {
    restore();
  }
});
test('panel retry remounts the failed panel', () => {
  const restore = silenceExpectedCrash();
  let broken = true;
  function Sometimes() {
    if (broken) return <Broken />;
    return <p>Taastatud</p>;
  }
  try {
    render(
      <PanelErrorBoundary>
        <Sometimes />
      </PanelErrorBoundary>,
    );
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: et.common.retry }));
    expect(screen.getByText('Taastatud')).toBeTruthy();
  } finally {
    restore();
  }
});
test('root boundary offers both recovery actions without exposing the exception', () => {
  const restore = silenceExpectedCrash();
  const onCopyAndReload = vi.fn(),
    onExportDiagnostics = vi.fn();
  try {
    render(
      <RootErrorBoundary
        onCopyAndReload={onCopyAndReload}
        onExportDiagnostics={onExportDiagnostics}
      >
        <Broken />
      </RootErrorBoundary>,
    );
    expect(screen.getByText(et.error.root)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: et.error.copyReload }));
    fireEvent.click(screen.getByRole('button', { name: et.error.diagnostics }));
    expect(onCopyAndReload).toHaveBeenCalledOnce();
    expect(onExportDiagnostics).toHaveBeenCalledOnce();
    expect(screen.queryByText('private crash detail')).toBeNull();
  } finally {
    restore();
  }
});
test('save status shows time as HH:MM in the local timezone', () => {
  const at = new Date(2026, 10, 8, 14, 32).toISOString();
  render(<SaveStatus status={{ state: 'saved', rev: 1, at }} />);
  expect(screen.getByRole('status').textContent).toBe('Salvestatud · 14:32');
});
test.each(['pending', 'saving'] as const)('%s shows saving without success toasts', (state) => {
  render(<SaveStatus status={{ state }} />);
  expect(screen.getByRole('status').textContent).toBe(et.save.saving);
});
test('every StorageReason has an Estonian text', () => {
  const expected = {
    disk_full: 'ketas täis',
    read_only: 'fail on kirjutuskaitstud',
    missing: 'faili ei leitud',
    locked: 'fail on avatud mujal',
    not_project: 'see fail ei ole PCB Kaardistaja projekt',
    too_new: 'fail on tehtud uuema äpiga',
    unknown: 'tundmatu viga',
  };
  expect(et.reason).toEqual(expected);
});
test('save errors keep retry and rescue actions visible', () => {
  const app = setup();
  act(() => app.projects.emit({ sessionId: 'session-a', state: 'error', reason: 'disk_full' }));
  expect(screen.getByRole('alert').textContent).toContain('Salvestamine ebaõnnestus: ketas täis.');
  fireEvent.click(screen.getByRole('button', { name: et.common.retry }));
  fireEvent.click(screen.getByRole('button', { name: et.common.saveElsewhere }));
  expect(app.onRetrySave).toHaveBeenCalledOnce();
  expect(app.onSaveElsewhere).toHaveBeenCalledOnce();
});
test('Ctrl+Z inside a text field does not trigger engine undo', () => {
  const app = setup(<input aria-label="Märkus" />);
  const undo = vi.spyOn(app.engine, 'undo');
  const redo = vi.spyOn(app.engine, 'redo');
  const input = screen.getByRole('textbox');
  fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
  expect(undo).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
  fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
  expect(undo).toHaveBeenCalledOnce();
  expect(redo).toHaveBeenCalledTimes(2);
});
test('pane resizing is keyboard accessible and retains the chosen width', () => {
  setup();
  fireEvent.keyDown(screen.getByRole('separator', { name: et.shell.resizeNavigator }), {
    key: 'ArrowRight',
  });
  expect(useViewStore.getState().navigatorWidth).toBe(310);
  fireEvent.keyDown(screen.getByRole('separator', { name: et.shell.resizeContext }), {
    key: 'ArrowLeft',
  });
  expect(useViewStore.getState().contextWidth).toBe(350);
});
test('switching projects never renders the previous selection in the new project', () => {
  const restore = silenceExpectedCrash();
  function Selected({ selection }: { selection: Selection }) {
    const sid = useSnapshot((s) => s.sessionId);
    if (sid === 'session-b' && selection.kind !== 'none') throw new Error('stale selection');
    return <p>{selection.kind === 'none' ? 'Valik puudub' : 'Valitud'}</p>;
  }
  const registry = new UiRegistry([
    {
      id: 'components',
      title: 'Komponendid',
      contextSections: [
        {
          id: 'selection',
          order: 0,
          appliesTo: ['none', 'component'],
          render: ({ selection }) => <Selected selection={selection} />,
        },
      ],
    },
  ]);
  const engine = new FakeEngine(snapshot());
  try {
    render(
      <EngineProvider engine={engine} projects={new FakeProjects()}>
        <AppShell {...actions()} canUndo={false} canRedo={false} registry={registry} />
      </EngineProvider>,
    );
    act(() => useSessionStore.getState().setSelection({ kind: 'component', id: 'cmp_old' }));
    expect(screen.getByText('Valitud')).toBeTruthy();
    act(() => engine.replace(snapshot('session-b', 0, 'Teine plaat')));
    expect(screen.queryByText(et.error.panel)).toBeNull();
    expect(screen.getByText('Valik puudub')).toBeTruthy();
  } finally {
    restore();
  }
});
test('navigator tabs support arrows without changing the selected component', () => {
  const registry = new UiRegistry([
    {
      id: 'test',
      title: 'Test',
      navigatorTabs: [
        { id: 'components', title: 'Komponendid', render: () => <p>Komponentide loend</p> },
        { id: 'log', title: 'Logi', render: () => <p>Tegevuste loend</p> },
      ],
    },
  ]);
  render(
    <EngineProvider engine={new FakeEngine()} projects={new FakeProjects()}>
      <AppShell {...actions()} canUndo={false} canRedo={false} registry={registry} />
    </EngineProvider>,
  );
  act(() => useSessionStore.getState().setSelection({ kind: 'component', id: 'cmp_kept' }));
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Komponendid' }), { key: 'ArrowRight' });
  const log = screen.getByRole('tab', { name: 'Logi' });
  expect(log.getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement).toBe(log);
  expect(useSessionStore.getState().selection).toEqual({ kind: 'component', id: 'cmp_kept' });
});
