import { useCallback, useEffect, useRef, useState } from 'react';
import { useEngine, useProjects } from '@pcbk/client';
import type {
  AppHost,
  BackupsReq,
  CreateReq,
  EngineError,
  ProjectInfo,
  RecentProject,
  StorageReason,
} from '@pcbk/contracts';
import { et } from '../shell/i18n/et';
import { useViewStore } from '../shell/view-store';
import { useProjectLists } from './use-project-lists';
import { sameProjectPath, useWorkbenchAction, useWorkbenchHost } from './use-workbench-host';

type CloseIntent = 'home' | 'host' | 'reload';
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
  const [restoreSource, setRestoreSource] = useState<RecentProject | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const { recent, available, refreshRecent } = useProjectLists(host, info === null, setLaunchError);
  const [closeError, setCloseError] = useState<{
    reason: StorageReason;
    intent: CloseIntent;
  } | null>(null);
  const { busy, run, runClose, finishHostAction } = useWorkbenchAction(setLaunchError);
  const activePath = useRef<string | null>(null);
  const discarding = useRef(false);

  const activate = useCallback(
    (next: ProjectInfo) => {
      useViewStore.getState().restore(next.view);
      activePath.current = next.path;
      setInfo(next);
      setCloseError(null);
      setCreateOpen(false);
      setRestoreSource(null);
      setLaunchError(null);
      setCreateError(null);
      void refreshRecent().catch(() => setLaunchError(et.error.root));
    },
    [refreshRecent],
  );

  const deactivate = useCallback(() => {
    activePath.current = null;
    setInfo(null);
    setCloseError(null);
    void refreshRecent().catch(() => setLaunchError(et.error.root));
  }, [refreshRecent]);

  const finishClose = useCallback(
    async (intent: CloseIntent) => {
      const result = await projects.close();
      if (!result.ok) {
        setCloseError({ reason: closeReason(result.error), intent });
        return false;
      }
      deactivate();
      return true;
    },
    [projects, deactivate],
  );

  const leaveWorkbench = (intent: CloseIntent) => {
    if (intent === 'home') return;
    discarding.current = true;
    finishHostAction(() => {
      if (intent === 'reload') host.reload();
      else host.closeNow();
    });
  };

  const goHome = useCallback(() => {
    void run(() => finishClose('home'));
  }, [run, finishClose]);

  const openProject = useCallback(
    async (path: string) => {
      if (activePath.current && sameProjectPath(activePath.current, path)) return;
      setLaunchError(null);
      const result = await projects.open({ path });
      if (result.ok) activate(result.value);
      else {
        setLaunchError(errorText(result.error));
        if (result.error.code === 'storage' && result.error.reason === 'missing') {
          setMissing((paths) => [...paths, path]);
        }
      }
    },
    [projects, activate],
  );

  const openFromHost = useCallback(
    (path: string) => {
      void run(() => openProject(path), true);
    },
    [run, openProject],
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

  const requestClose = useCallback(
    () => runClose(() => finishClose('host')),
    [runClose, finishClose],
  );
  const diagnose = useWorkbenchHost(host, openFromHost, requestClose, discarding, setLaunchError);

  const create = (request: CreateReq) => {
    void run(async () => {
      setCreateError(null);
      const result = await projects.create(request);
      if (result.ok) activate(result.value);
      else setCreateError(errorText(result.error));
    });
  };

  const pickProjectFile = () => {
    void run(async () => {
      const path = await host.pickProjectFile?.();
      if (path) await openProject(path);
    });
  };

  const loadBackups = useCallback((req: BackupsReq) => projects.backups(req), [projects]);

  const restore = (backup: string) =>
    run(async () => {
      if (!restoreSource) return false;
      try {
        const dest = await host.pickSavePath?.(et.project.restoreName(restoreSource.name));
        if (!dest) return true;
        const result = await projects.restore({ backup, dest });
        if (!result.ok) return false;
        activate(result.value);
        return true;
      } catch {
        return false;
      }
    });

  const removeRecent = (path: string) => {
    void run(async () => {
      await host.removeRecent(path);
      await refreshRecent();
    });
  };

  const copy = (intent: CopyIntent) => {
    void run(async () => {
      if (!info || (!host.pickSavePath && !(intent === 'reload' && host.recoveryCopyPath))) {
        setLaunchError(et.project.copyUnavailable);
        return;
      }
      const dest =
        intent === 'reload' && host.recoveryCopyPath
          ? await host.recoveryCopyPath(info.path)
          : await host.pickSavePath?.(info.name);
      if (!dest) return;
      const result = await projects.copy({ dest, identity: 'same' });
      if (!result.ok) {
        setLaunchError(errorText(result.error));
        return;
      }
      activate(result.value);
      if (intent === 'reload') {
        if (await finishClose('reload')) leaveWorkbench('reload');
      }
      if (intent === 'close') {
        const closeIntent = closeError?.intent ?? 'home';
        if (await finishClose(closeIntent)) leaveWorkbench(closeIntent);
      }
    });
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
    restoreSource,
    launchError,
    closeError,
    busy,
    goHome,
    create,
    open,
    pickProjectFile,
    loadBackups,
    restore,
    removeRecent,
    copy,
    diagnose,
    openCreate: () => {
      setCreateError(null);
      setCreateOpen(true);
    },
    closeCreate: () => setCreateOpen(false),
    openRestore: setRestoreSource,
    closeRestore: () => setRestoreSource(null),
    dismissError: () => setLaunchError(null),
    cancelClose: () => setCloseError(null),
    retrySave: () => {
      void projects.flush();
    },
    retryClose: () => {
      const intent = closeError?.intent ?? 'home';
      void run(async () => {
        if (await finishClose(intent)) leaveWorkbench(intent);
      });
    },
    discard: () => {
      const intent = closeError?.intent ?? 'home';
      void run(async () => {
        const result = await projects.discard();
        if (!result.ok) {
          setCloseError({ reason: closeReason(result.error), intent });
          return;
        }
        deactivate();
        leaveWorkbench(host.kind === 'web' && intent === 'home' ? 'host' : intent);
      });
    },
  };
}
