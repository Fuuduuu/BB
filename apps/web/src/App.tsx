import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CreateReq, EngineError, ProjectInfo, StorageReason } from '@pcbk/contracts';
import {
  AppShell,
  Button,
  CloseDialog,
  NewBoardDialog,
  RootErrorBoundary,
  StartScreen,
  UiRegistry,
  et,
  useViewStore,
  useTheme,
} from '@pcbk/ui';
import type { Runtime } from './runtime';
import type { RecentProject } from '@pcbk/adapters';
import { uiFeatures } from './ui.features';

function errorText(error: EngineError) {
  if (error.code === 'storage') return et.reason[error.reason];
  if (error.code === 'read_only') return et.reason.read_only;
  if (error.code === 'stale_rev') return et.project.changedElsewhere;
  return et.component.failed;
}
function exportDiagnostics(runtime: Runtime) {
  const snapshot = runtime.engine.snapshot();
  const blob = new Blob(
    [
      JSON.stringify(
        {
          app: et.appName,
          version: '0.0.0',
          at: new Date().toISOString(),
          rev: snapshot.rev,
          hasProject: !!snapshot.sessionId,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = 'pcbk-diagnostika.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function App({ runtime }: { runtime: Runtime }) {
  useTheme();
  const [info, setInfo] = useState<ProjectInfo | null>(null);
  const [recent, setRecent] = useState(() => runtime.repo.recents());
  const [availableProjects, setAvailableProjects] = useState<RecentProject[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<StorageReason | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const discarding = useRef(false);
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      setLaunchError(et.error.root);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function activate(next: ProjectInfo) {
    useViewStore.getState().restore(next.view);
    setInfo(next);
    setRecent(runtime.repo.recents());
    setCreateOpen(false);
    setLaunchError(null);
    setCreateError(null);
  }
  const goHome = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await runtime.projects.close();
      if (result.ok) {
        setInfo(null);
        setCloseError(null);
        setRecent(runtime.repo.recents());
      } else
        setCloseError(
          result.error.code === 'storage'
            ? result.error.reason
            : result.error.code === 'read_only'
              ? 'read_only'
              : 'unknown',
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [runtime]);
  const registry = useMemo(
    () =>
      new UiRegistry(
        uiFeatures(runtime.ids, () => {
          void goHome();
        }),
      ),
    [runtime, goHome],
  );
  useEffect(() => {
    if (info) return;
    let active = true;
    void runtime.repo
      .listProjects()
      .then((list) => {
        if (active) setAvailableProjects(list);
      })
      .catch(() => {
        if (active) setLaunchError(et.project.openFailed);
      });
    return () => {
      active = false;
    };
  }, [runtime, info, recent]);
  useEffect(() => {
    if (!info) return;
    return useViewStore.subscribe((next, previous) => {
      if (runtime.engine.snapshot().sessionId !== info.sessionId) return;
      if (
        next.navigatorWidth !== previous.navigatorWidth ||
        next.navigatorTab !== previous.navigatorTab ||
        next.contextWidth !== previous.contextWidth ||
        next.contextOpen !== previous.contextOpen
      )
        runtime.projects.saveView(next.getView());
    });
  }, [runtime, info]);
  useEffect(() => {
    let unsaved = false;
    const stop = runtime.projects.status((status) => {
      unsaved = status.state !== 'saved';
    });
    const warn = (event: BeforeUnloadEvent) => {
      if (!discarding.current && runtime.engine.snapshot().sessionId && unsaved) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      stop();
      window.removeEventListener('beforeunload', warn);
    };
  }, [runtime]);
  const diagnose = () => exportDiagnostics(runtime);
  const unavailable = () => setLaunchError(et.project.copyUnavailable);
  const create = (request: CreateReq) => {
    void run(async () => {
      setCreateError(null);
      const result = await runtime.projects.create(request);
      if (result.ok) activate(result.value);
      else setCreateError(errorText(result.error));
    });
  };
  const open = (path: string) => {
    void run(async () => {
      setLaunchError(null);
      const result = await runtime.projects.open({ path });
      if (result.ok) activate(result.value);
      else {
        setLaunchError(errorText(result.error));
        if (result.error.code === 'storage' && result.error.reason === 'missing')
          setMissing((paths) => [...paths, path]);
      }
    });
  };
  return (
    <RootErrorBoundary
      onCopyAndReload={unavailable}
      onExportDiagnostics={diagnose}
      copyAvailable={false}
    >
      {info ? (
        <AppShell
          manageTheme={false}
          registry={registry}
          copyAvailable={false}
          onRetrySave={() => {
            void runtime.projects.flush();
          }}
          onSaveElsewhere={unavailable}
          onCopyAndReload={unavailable}
          onExportDiagnostics={diagnose}
        />
      ) : (
        <StartScreen
          recent={recent.map((item) => ({ ...item, missing: missing.includes(item.path) }))}
          availableProjects={availableProjects.map((item) => ({
            ...item,
            missing: missing.includes(item.path),
          }))}
          onNew={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
          onOpen={open}
          onRemoveRecent={(path) => {
            runtime.repo.removeRecent(path);
            setRecent(runtime.repo.recents());
          }}
        />
      )}
      <NewBoardDialog
        open={createOpen}
        busy={busy}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onCreate={create}
      />
      <CloseDialog
        open={closeError !== null}
        reason={closeError ?? 'unknown'}
        busy={busy}
        copyAvailable={false}
        onCancel={() => setCloseError(null)}
        onRetrySave={() => {
          void goHome();
        }}
        onSaveElsewhere={unavailable}
        onDiscard={() => {
          discarding.current = true;
          window.location.reload();
        }}
      />
      {launchError && (
        <div className="pcbk-web-alert" role="alert">
          <span>{launchError}</span>
          <Button onClick={() => setLaunchError(null)} aria-label={et.common.close}>
            {et.common.close}
          </Button>
        </div>
      )}
    </RootErrorBoundary>
  );
}
