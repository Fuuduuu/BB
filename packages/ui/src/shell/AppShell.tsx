import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useEngine, useSaveStatus, useSnapshot } from '@pcbk/client';
import type { Snapshot } from '@pcbk/contracts';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from './TopBar';
import { ErrorBar } from './ErrorBar';
import type { SaveRecoveryActions } from './ErrorBar';
import { PanelErrorBoundary, RootErrorBoundary } from './ErrorBoundary';
import type { RootRecoveryActions } from './ErrorBoundary';
import { ResizeHandle } from './ResizeHandle';
import { UiRegistry, type PinnedSpec } from './UiRegistry';
import { bindHistoryKeys } from './keymap';
import { useSessionStore } from './session-store';
import type { Selection } from './session-store';
import { useViewStore } from './view-store';
import { useTheme } from './use-theme';
import { et } from './i18n/et';

const emptyRegistry = new UiRegistry();
const noSelection: Selection = { items: [] };
function useSelection(sessionId: string, components: Snapshot['doc']['components']) {
  const selected = useSessionStore((s) => (s.sessionId === sessionId ? s.selection : noSelection));
  const valid = useMemo(() => {
    const items = selected.items.filter((item) => {
      if (item.kind === 'component') return components.some(({ id }) => id === item.id);
      if (item.kind === 'pin') {
        const component = components.find(({ id }) => id === item.componentId);
        return component?.pins.some(({ id }) => id === item.id);
      }
      return true;
    });
    return items.length === selected.items.length ? selected : { items };
  }, [components, selected]);
  useEffect(() => {
    if (valid === selected) return;
    const current = useSessionStore.getState();
    if (current.sessionId === sessionId && current.selection === selected) {
      current.setSelection(valid);
    }
  }, [selected, sessionId, valid]);
  return valid;
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
  const snapshot = useSnapshot((current) => current);
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
        {tabs.map((tab, index) => {
          const count = tab.count?.(snapshot) ?? 0;
          return (
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
              {count > 0 && ` (${count})`}
            </button>
          );
        })}
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
function Context({
  registry,
  selection,
  pinned,
}: {
  registry: UiRegistry;
  selection: Selection;
  pinned: PinnedSpec[];
}) {
  const sections = registry.contextSections(selection);
  return (
    <>
      <div className="pcbk-pane-heading">{et.shell.context}</div>
      <div className="pcbk-pane-content">
        {pinned.map((section) => (
          <section key={section.id}>{section.render()}</section>
        ))}
        {sections.map((section) => (
          <section key={section.id}>{section.render({ selection })}</section>
        ))}
        {selection.items.length === 0 && pinned.length === 0 && (
          <p className="pcbk-empty-pane">{et.shell.contextEmpty}</p>
        )}
      </div>
    </>
  );
}
interface ContextPaneProps {
  registry: UiRegistry;
  selection: Selection;
  pinned: PinnedSpec[];
  sessionId: string;
  wide: boolean;
  open: boolean;
  width: number;
  onResize(width: number): void;
}
function ContextPane({
  registry,
  selection,
  pinned,
  sessionId,
  open,
  width,
  onResize,
}: ContextPaneProps) {
  if (!open) return null;
  return (
    <>
      <ResizeHandle
        label={et.shell.resizeContext}
        width={width}
        min={280}
        max={460}
        side="right"
        controls="pcbk-context"
        onResize={onResize}
      />
      <aside className="pcbk-context" id="pcbk-context" aria-label={et.shell.context}>
        <PanelErrorBoundary key={sessionId}>
          <Context registry={registry} selection={selection} pinned={pinned} />
        </PanelErrorBoundary>
      </aside>
    </>
  );
}
function createPinnedContextPane(registry: UiRegistry) {
  // Keep each registered hook mounted with a stable component type while the pane is closed.
  return registry.contextPinned().reduceRight((Next, section) => {
    return function PinnedContextPane({ pinned, wide, ...props }: ContextPaneProps) {
      const visible = section.useVisible();
      useEffect(() => {
        const view = useViewStore.getState();
        if (!wide && visible && !view.contextOpen) view.setContextOpen(true);
      }, [wide, visible]);
      return <Next {...props} wide={wide} pinned={visible ? [...pinned, section] : pinned} />;
    };
  }, ContextPane);
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
  const view = useViewStore(
    useShallow(
      ({ navigatorWidth, contextWidth, contextOpen, setNavigatorWidth, setContextWidth }) => ({
        navigatorWidth,
        contextWidth,
        contextOpen,
        setNavigatorWidth,
        setContextWidth,
      }),
    ),
  );
  useTheme(props.manageTheme !== false);
  const selection = useSelection(sessionId, components);
  const wide = useSyncExternalStore(subscribeWidth, isWide, () => true);
  const PinnedContextPane = useMemo(() => createPinnedContextPane(registry), [registry]);
  const activeSession = useRef<string>();
  useLayoutEffect(() => {
    if (activeSession.current === sessionId) return;
    activeSession.current = sessionId;
    useSessionStore.getState().reset(sessionId);
    registry.resetSession();
  }, [registry, sessionId]);
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
    if (!wide && selection.items.length > 0) useViewStore.getState().setContextOpen(true);
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
        <PinnedContextPane
          registry={registry}
          selection={selection}
          pinned={[]}
          sessionId={sessionId}
          wide={wide}
          open={view.contextOpen}
          width={view.contextWidth}
          onResize={view.setContextWidth}
        />
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
