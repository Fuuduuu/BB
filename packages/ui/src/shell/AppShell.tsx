import { useEffect, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useEngine, useSaveStatus, useSnapshot } from '@pcbk/client';
import type { Snapshot } from '@pcbk/contracts';
import { TopBar } from './TopBar';
import { ErrorBar } from './ErrorBar';
import type { SaveRecoveryActions } from './ErrorBar';
import { PanelErrorBoundary, RootErrorBoundary } from './ErrorBoundary';
import type { RootRecoveryActions } from './ErrorBoundary';
import { ResizeHandle } from './ResizeHandle';
import { UiRegistry } from './UiRegistry';
import { bindHistoryKeys } from './keymap';
import { useSessionStore } from './session-store';
import type { Selection } from './session-store';
import { useViewStore } from './view-store';
import { useTheme } from './use-theme';
import { et } from './i18n/et';

const emptyRegistry = new UiRegistry();
const noSelection: Selection = { kind: 'none' };
function useSelection(sessionId: string, components: Snapshot['doc']['components']) {
  const selected = useSessionStore((s) => (s.sessionId === sessionId ? s.selection : noSelection));
  const missing =
    (selected.kind === 'component' &&
      !components.some((component) => component.id === selected.id)) ||
    (selected.kind === 'pin' &&
      !components.some(
        (component) =>
          component.id === selected.componentId &&
          component.pins.some((pin) => pin.id === selected.pinId),
      ));
  useEffect(() => {
    if (!missing) return;
    const current = useSessionStore.getState();
    if (current.sessionId === sessionId && current.selection === selected) {
      current.setSelection(noSelection);
    }
  }, [missing, selected, sessionId]);
  return missing ? noSelection : selected;
}
const wideQuery = '(min-width: 1280px)';
function subscribeWidth(notify: () => void) {
  const media = window.matchMedia?.(wideQuery);
  media?.addEventListener('change', notify);
  return () => media?.removeEventListener('change', notify);
}
const isWide = () => window.matchMedia?.(wideQuery).matches ?? true;

export interface AppShellProps extends SaveRecoveryActions, RootRecoveryActions {
  registry?: UiRegistry;
  canvas?: ReactNode;
  manageTheme?: boolean;
}
export function AppShell(props: AppShellProps) {
  return (
    <RootErrorBoundary {...props}>
      <Workspace {...props} />
    </RootErrorBoundary>
  );
}
function Navigator({ registry }: { registry: UiRegistry }) {
  const tabs = registry.navigatorTabs();
  const tabId = useViewStore((s) => s.navigatorTab);
  const setTab = useViewStore((s) => s.setNavigatorTab);
  const active = tabs.find((tab) => tab.id === tabId) ?? tabs[0];
  if (!active)
    return (
      <>
        <div className="pcbk-pane-heading">{et.shell.components}</div>
        <p className="pcbk-empty-pane">{et.shell.navigatorEmpty}</p>
      </>
    );
  return (
    <>
      <div className="pcbk-tabs" role="tablist" aria-label={et.shell.navigator}>
        {tabs.map((tab, index) => (
          <button
            type="button"
            role="tab"
            id={`pcbk-tab-${tab.id}`}
            key={tab.id}
            tabIndex={active.id === tab.id ? 0 : -1}
            aria-selected={active.id === tab.id}
            aria-controls={`pcbk-tab-panel-${tab.id}`}
            onClick={() => setTab(tab.id)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = tabs.length - 1;
              else return;
              event.preventDefault();
              const target = tabs[next]!;
              setTab(target.id);
              document.getElementById(`pcbk-tab-${target.id}`)?.focus();
            }}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div
        className="pcbk-pane-content"
        role="tabpanel"
        id={`pcbk-tab-panel-${active.id}`}
        aria-labelledby={`pcbk-tab-${active.id}`}
      >
        {active.render()}
      </div>
    </>
  );
}
function Context({ registry, selection }: { registry: UiRegistry; selection: Selection }) {
  const sections = registry.contextSections(selection);
  return (
    <>
      <div className="pcbk-pane-heading">{et.shell.context}</div>
      <div className="pcbk-pane-content">
        {sections.length ? (
          sections.map((section) => (
            <section key={section.id}>{section.render({ selection })}</section>
          ))
        ) : (
          <p className="pcbk-empty-pane">{et.shell.contextEmpty}</p>
        )}
      </div>
    </>
  );
}
function ExtraSlots({ registry, slot }: { registry: UiRegistry; slot: 'topBar' | 'bottomBar' }) {
  return registry[slot]().map((entry) => <div key={entry.id}>{entry.render()}</div>);
}
function Workspace({ registry = emptyRegistry, canvas, ...props }: AppShellProps) {
  const engine = useEngine();
  const { sessionId, name, history, components } = useSnapshot((s) => ({
    sessionId: s.sessionId,
    name: s.doc.name,
    history: s.history,
    components: s.doc.components,
  }));
  const status = useSaveStatus();
  const view = useViewStore();
  useTheme(props.manageTheme !== false);
  const selection = useSelection(sessionId, components);
  const wide = useSyncExternalStore(subscribeWidth, isWide, () => true);
  useEffect(() => {
    useSessionStore.getState().reset(sessionId);
  }, [sessionId]);
  useEffect(
    () =>
      bindHistoryKeys(window, {
        undo: () => {
          if (history.canUndo) engine.undo();
        },
        redo: () => {
          if (history.canRedo) engine.redo();
        },
      }),
    [engine, history.canUndo, history.canRedo],
  );
  useEffect(() => {
    if (!wide && selection.kind !== 'none') useViewStore.getState().setContextOpen(true);
  }, [wide, selection]);
  const style = {
    '--navigator-width': `${view.navigatorWidth}px`,
    '--context-width': `${view.contextWidth}px`,
  } as CSSProperties;
  return (
    <div className="pcbk-app" style={style}>
      <TopBar
        name={name}
        status={status}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => engine.undo()}
        onRedo={() => engine.redo()}
      >
        <PanelErrorBoundary>
          <ExtraSlots registry={registry} slot="topBar" />
        </PanelErrorBoundary>
      </TopBar>
      {status.state === 'error' && <ErrorBar reason={status.reason} {...props} />}
      <div className="pcbk-workspace" id="workspace" data-context-open={view.contextOpen}>
        <aside className="pcbk-navigator" id="pcbk-navigator" aria-label={et.shell.navigator}>
          <PanelErrorBoundary key={sessionId}>
            <Navigator registry={registry} />
          </PanelErrorBoundary>
        </aside>
        <ResizeHandle
          label={et.shell.resizeNavigator}
          width={view.navigatorWidth}
          min={240}
          max={420}
          side="left"
          controls="pcbk-navigator"
          onResize={view.setNavigatorWidth}
        />
        <main className="pcbk-canvas" aria-label={et.shell.canvas}>
          <PanelErrorBoundary key={sessionId}>
            {canvas ?? (
              <div className="pcbk-canvas-empty">
                <span className="pcbk-board-symbol" aria-hidden="true">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 36 36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="8" y="8" width="20" height="20" rx="3" />
                    <path d="M13 3v5m10-5v5M13 28v5m10-5v5M3 13h5m-5 10h5m20-10h5m-5 10h5M13 18h5v5h5" />
                    <circle cx="13" cy="18" r="2" />
                    <circle cx="23" cy="23" r="2" />
                  </svg>
                </span>
                <h2>{et.shell.canvasEmpty}</h2>
                <p>{et.shell.canvasHint}</p>
              </div>
            )}
          </PanelErrorBoundary>
        </main>
        {view.contextOpen && (
          <>
            <ResizeHandle
              label={et.shell.resizeContext}
              width={view.contextWidth}
              min={280}
              max={460}
              side="right"
              controls="pcbk-context"
              onResize={view.setContextWidth}
            />
            <aside className="pcbk-context" id="pcbk-context" aria-label={et.shell.context}>
              <PanelErrorBoundary key={sessionId}>
                <Context registry={registry} selection={selection} />
              </PanelErrorBoundary>
            </aside>
          </>
        )}
      </div>
      <footer className="pcbk-bottom-bar" aria-label={et.shell.bottomBar}>
        <span className="pcbk-ready">
          <i aria-hidden="true" />
          {et.shell.ready}
        </span>
        <PanelErrorBoundary>
          <ExtraSlots registry={registry} slot="bottomBar" />
        </PanelErrorBoundary>
      </footer>
    </div>
  );
}
