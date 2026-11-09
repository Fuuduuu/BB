import { useCallback, useEffect, useRef, useState } from 'react';
import { useEngine, useProjects } from '@pcbk/client';
import type {
  AppHost,
  CreateReq,
  EngineError,
  ProjectInfo,
  RecentProject,
  StorageReason,
} from '@pcbk/contracts';
import { et } from '../shell/i18n/et';
import { useViewStore } from '../shell/view-store';
import { useProjectLists } from './use-project-lists';
import { useWorkbenchHost } from './use-workbench-host';

type CloseIntent = 'home' | 'host';
type CopyIntent = 'stay' | 'reload' | 'close';

function errorText(error: EngineError) {
  if (error.code === 'storage') return et.reason[error.reason];
  if (error.code === 'read_only') return et.reason.read_only;
  if (error.code === 'stale_rev') return et.project.changedElsewhere;
  return et.component.failed;
}

function closeReason(error: EngineError): StorageReason {
  if (error.code === 'storage') return error.reason;
  return error.code === 'read_only' ? 'read_only' : 'unknown';
}

export function useWorkbench(host: AppHost) {
  const engine = useEngine();
  const projects = useProjects();
  const [info, setInfo] = useState<ProjectInfo | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const { recent, available, refreshRecent } = useProjectLists(host, info === null, setLaunchError);
  const [closeError, setCloseError] = useState<{
    reason: StorageReason;
    intent: CloseIntent;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const discarding = useRef(false);

  const run = useCallback(async (action: () => Promise<boolean | void>) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      return (await action()) ?? true;
    } catch {
      setLaunchError(et.error.root);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);

  const activate = useCallback(
    async (next: ProjectInfo) => {
      useViewStore.getState().restore(next.view);
      setInfo(next);
      setCreateOpen(false);
      setLaunchError(null);
      setCreateError(null);
      await refreshRecent();
    },
    [refreshRecent],
  );

  const finishClose = useCallback(
    async (intent: CloseIntent) => {
      const result = await projects.close();
      if (!result.ok) {
        setCloseError({ reason: closeReason(result.error), intent });
        return false;
      }
      setInfo(null);
      setCloseError(null);
      void refreshRecent().catch(() => setLaunchError(et.error.root));
      return true;
    },
    [projects, refreshRecent],
  );

  const goHome = useCallback(() => {
    void run(() => finishClose('home'));
  }, [run, finishClose]);

  const openProject = useCallback(
    async (path: string) => {
      setLaunchError(null);
      const result = await projects.open({ path });
      if (result.ok) await activate(result.value);
      else {
        setLaunchError(errorText(result.error));
        if (result.error.code === 'storage' && result.error.reason === 'missing') {
          setMissing((paths) => [...paths, path]);
        }
      }
    },
    [projects, activate],
  );

  const open = useCallback(
    (path: string) => {
      void run(() => openProject(path));
    },
    [run, openProject],
  );

  useEffect(() => {
    if (!info) return;
    return useViewStore.subscribe((next, previous) => {
      if (engine.snapshot().sessionId !== info.sessionId) return;
      if (
        next.navigatorWidth !== previous.navigatorWidth ||
        next.navigatorTab !== previous.navigatorTab ||
        next.contextWidth !== previous.contextWidth ||
        next.contextOpen !== previous.contextOpen
      ) {
        projects.saveView(next.getView());
      }
    });
  }, [engine, projects, info]);

  const requestClose = useCallback(async () => {
    if (pending.current) return false;
    if (!engine.snapshot().sessionId) return true;
    return run(() => finishClose('host'));
  }, [engine, run, finishClose]);
  useWorkbenchHost(host, open, requestClose, discarding);

  const create = (request: CreateReq) => {
    void run(async () => {
      setCreateError(null);
      const result = await projects.create(request);
      if (result.ok) await activate(result.value);
      else setCreateError(errorText(result.error));
    });
  };

  const pickProjectFile = () => {
    void run(async () => {
      const path = await host.pickProjectFile?.();
      if (path) await openProject(path);
    });
  };

  const removeRecent = (path: string) => {
    void run(async () => {
      await host.removeRecent(path);
      await refreshRecent();
    });
  };

  const copy = (intent: CopyIntent) => {
    void run(async () => {
      if (!info || !host.pickSavePath) {
        setLaunchError(et.project.copyUnavailable);
        return;
      }
      const dest = await host.pickSavePath(info.name);
      if (!dest) return;
      const result = await projects.copy({ dest, identity: 'same' });
      if (!result.ok) {
        setLaunchError(errorText(result.error));
        return;
      }
      await activate(result.value);
      if (intent === 'reload') host.reload();
      if (intent === 'close') {
        const closeIntent = closeError?.intent ?? 'home';
        if ((await finishClose(closeIntent)) && closeIntent === 'host') host.closeNow();
      }
    });
  };

  const diagnose = () => {
    const snapshot = engine.snapshot();
    const summary = JSON.stringify(
      {
        app: et.appName,
        version: '0.0.0',
        at: new Date().toISOString(),
        rev: snapshot.rev,
        hasProject: Boolean(snapshot.sessionId),
      },
      null,
      2,
    );
    void host.saveDiagnostics(summary).catch(() => setLaunchError(et.error.root));
  };

  const withMissing = (item: RecentProject) => ({
    ...item,
    missing: Boolean(item.missing || missing.includes(item.path)),
  });
  return {
    info,
    recent: recent.map(withMissing),
    available: available.map(withMissing),
    createOpen,
    createError,
    launchError,
    closeError,
    busy,
    goHome,
    create,
    open,
    pickProjectFile,
    removeRecent,
    copy,
    diagnose,
    openCreate: () => {
      setCreateError(null);
      setCreateOpen(true);
    },
    closeCreate: () => setCreateOpen(false),
    dismissError: () => setLaunchError(null),
    cancelClose: () => setCloseError(null),
    retrySave: () => {
      void projects.flush();
    },
    retryClose: () => {
      const intent = closeError?.intent ?? 'home';
      void run(async () => {
        if ((await finishClose(intent)) && intent === 'host') host.closeNow();
      });
    },
    discard: () => {
      discarding.current = true;
      host.closeNow();
    },
  };
}
