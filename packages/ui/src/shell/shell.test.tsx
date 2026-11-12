// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EngineProvider, useSnapshot } from '@pcbk/client';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { AppShell } from './AppShell';
import { PanelErrorBoundary, RootErrorBoundary } from './ErrorBoundary';
import { SaveStatus } from './SaveStatus';
import { ErrorBar } from './ErrorBar';
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
function snapshotWithComponent(id: string): ReturnType<typeof snapshot> {
  const initial = snapshot();
  return {
    ...initial,
    doc: {
      ...initial.doc,
      components: [
        {
          id,
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
  };
}
function setup(canvas?: React.ReactNode) {
  const engine = new FakeEngine(snapshot('session-a', 0, 'Minu plaat'));
  const projects = new FakeProjects();
  const callbacks = actions();
  render(
    <EngineProvider engine={engine} projects={projects}>
      <AppShell {...callbacks} canvas={canvas} />
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
    exists: 'See failinimi on juba kasutusel. Vali uus failinimi.',
    not_project: 'see fail ei ole PCB Kaardistaja projekt',
    too_new: 'fail on tehtud uuema äpiga',
    unsupported_image:
      'Seda pildivormingut ei saa avada. Salvesta pilt tavalise JPEG- või PNG-failina.',
    image_too_large: 'Pilt on liiga suur (üle 100 MP või 200 MB).',
    corrupt_image: 'Pildifail on vigane või poolik.',
    stale_rev:
      'Projekti muudeti teises aknas. Sinu muudatused on alles ainult selles aknas; salvesta need mujale.',
    unknown: 'tundmatu viga',
  };
  expect(et.reason).toEqual(expected);
});
test('a host without copy support disables the rescue action with an explanation', () => {
  render(
    <ErrorBar
      reason="disk_full"
      copyAvailable={false}
      onRetrySave={vi.fn()}
      onSaveElsewhere={vi.fn()}
    />,
  );
  const copy = screen.getByRole('button', { name: et.common.saveElsewhere }) as HTMLButtonElement;
  expect(copy.disabled).toBe(true);
  expect(copy.title).toBe(et.project.copyUnavailable);
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

test('stale_rev_status_shows_changed_elsewhere_without_retry', () => {
  const app = setup();
  act(() => app.projects.emit({ sessionId: 'session-a', state: 'error', reason: 'stale_rev' }));
  expect(screen.getByRole('alert').textContent).toContain(
    'Projekti muudeti teises aknas. Sinu muudatused on alles ainult selles aknas; salvesta need mujale.',
  );
  expect(screen.queryByRole('button', { name: et.common.retry })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: et.common.saveElsewhere }));
  expect(app.onSaveElsewhere).toHaveBeenCalledOnce();
});
test('Ctrl+Z inside a text field does not trigger engine undo', () => {
  const app = setup(<input aria-label="Märkus" />);
  act(() =>
    app.engine.replace({ ...snapshot('session-a', 1), history: { canUndo: true, canRedo: true } }),
  );
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
test('history buttons follow the engine snapshot rather than a second UI history', () => {
  const engine = new FakeEngine({ ...snapshot(), history: { canUndo: true, canRedo: false } });
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell {...actions()} />
    </EngineProvider>,
  );
  expect((screen.getByRole('button', { name: et.shell.undo }) as HTMLButtonElement).disabled).toBe(
    false,
  );
  expect((screen.getByRole('button', { name: et.shell.redo }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  act(() =>
    engine.replace({ ...snapshot('session-a', 1), history: { canUndo: false, canRedo: true } }),
  );
  expect((screen.getByRole('button', { name: et.shell.undo }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect((screen.getByRole('button', { name: et.shell.redo }) as HTMLButtonElement).disabled).toBe(
    false,
  );
});
test('a restored open context panel stays open in a narrow window', () => {
  const previous = window.matchMedia;
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  try {
    useViewStore.getState().restore({
      navigatorWidth: 300,
      navigatorTab: 'components',
      contextWidth: 360,
      contextOpen: true,
    });
    setup();
    expect(screen.getByRole('complementary', { name: et.shell.context })).toBeTruthy();
    expect(useViewStore.getState().contextWidth).toBe(360);
  } finally {
    window.matchMedia = previous;
  }
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
    if (sid === 'session-b' && selection.items.length) throw new Error('stale selection');
    return <p>Valitud</p>;
  }
  const registry = new UiRegistry([
    {
      id: 'components',
      title: 'Komponendid',
      contextSections: [
        {
          id: 'selection',
          order: 0,
          appliesTo: ['component'],
          render: ({ selection }) => <Selected selection={selection} />,
        },
      ],
    },
  ]);
  const engine = new FakeEngine(snapshotWithComponent('cmp_old'));
  try {
    render(
      <EngineProvider engine={engine} projects={new FakeProjects()}>
        <AppShell {...actions()} registry={registry} />
      </EngineProvider>,
    );
    act(() =>
      useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_old' }] }),
    );
    expect(screen.getByText('Valitud')).toBeTruthy();
    act(() => engine.replace(snapshot('session-b', 0, 'Teine plaat')));
    expect(screen.queryByText(et.error.panel)).toBeNull();
    expect(screen.getByText(et.shell.contextEmpty)).toBeTruthy();
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
    <EngineProvider
      engine={new FakeEngine(snapshotWithComponent('cmp_kept'))}
      projects={new FakeProjects()}
    >
      <AppShell {...actions()} registry={registry} />
    </EngineProvider>,
  );
  act(() =>
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_kept' }] }),
  );
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Komponendid' }), { key: 'ArrowRight' });
  const log = screen.getByRole('tab', { name: 'Logi' });
  expect(log.getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement).toBe(log);
  expect(useSessionStore.getState().selection).toEqual({
    items: [{ kind: 'component', id: 'cmp_kept' }],
  });
});

test('navigator tab shows its current count only when positive', () => {
  const registry = new UiRegistry([
    {
      id: 'test',
      title: 'Test',
      navigatorTabs: [
        {
          id: 'unplaced',
          title: 'Plaadile paigutamata',
          count: (current) => current.doc.components.length,
          render: () => null,
        },
      ],
    },
  ]);
  const engine = new FakeEngine(snapshotWithComponent('cmp_1'));
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell {...actions()} registry={registry} />
    </EngineProvider>,
  );
  expect(screen.getByRole('tab').textContent).toBe('Plaadile paigutamata (1)');
  act(() => engine.replace(snapshot('session-a', 1)));
  expect(screen.getByRole('tab').textContent).toBe('Plaadile paigutamata');
});

test('session_reset_hook_called_on_project_switch', () => {
  const sessionChanges: string[] = [];
  const registry = new UiRegistry([
    {
      id: 'test',
      title: 'Test',
      onSessionReset: () => sessionChanges.push(useSessionStore.getState().sessionId),
    },
  ]);
  const engine = new FakeEngine(snapshot('session-a', 0));
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell {...actions()} registry={registry} />
    </EngineProvider>,
  );
  expect(sessionChanges).toEqual(['session-a']);
  act(() => engine.replace(snapshot('session-a', 1)));
  expect(sessionChanges).toEqual(['session-a']);
  act(() => engine.replace(snapshot('session-b', 0)));
  expect(sessionChanges).toEqual(['session-a', 'session-b']);
});

test('selection_cleared_when_selected_item_disappears', () => {
  const engine = new FakeEngine(snapshotWithComponent('cmp_present'));
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell {...actions()} />
    </EngineProvider>,
  );
  act(() =>
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_present' }] }),
  );
  act(() => engine.replace(snapshot('session-a', 1)));
  expect(useSessionStore.getState().selection).toEqual({ items: [] });
});
