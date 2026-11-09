import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useEngine, useProjects } from '@pcbk/client';
import type { AppHost } from '@pcbk/contracts';
import { et } from '../shell/i18n/et';

type WorkbenchAction = () => Promise<boolean | void>;
type CloseRequest = { action: WorkbenchAction; resolve(allowed: boolean): void };

export function useWorkbenchAction(reportError: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const queuedOpen = useRef<WorkbenchAction | null>(null);
  const queuedClose = useRef<CloseRequest | null>(null);
  const closing = useRef(false);
  const finishHostAction = useCallback((finish: () => void) => {
    queuedOpen.current = null;
    const close = queuedClose.current;
    queuedClose.current = null;
    // The session is already closed. A waiting native close owns the window.
    if (close) close.resolve(true);
    else finish();
  }, []);

  const run = useCallback(
    async function runAction(action: WorkbenchAction, queueIfBusy = false): Promise<boolean> {
      if (pending.current) {
        if (queueIfBusy && !closing.current) queuedOpen.current = action;
        return false;
      }
      pending.current = true;
      setBusy(true);
      try {
        return (await action()) ?? true;
      } catch {
        reportError(et.error.root);
        return false;
      } finally {
        pending.current = false;
        const close = queuedClose.current;
        const open = queuedOpen.current;
        queuedClose.current = null;
        queuedOpen.current = null;
        if (close) void runAction(close.action).then(close.resolve);
        else if (open) void runAction(open);
        else setBusy(false);
      }
    },
    [reportError],
  );

  const runClose = useCallback(
    async (action: WorkbenchAction) => {
      if (closing.current) return false;
      closing.current = true;
      queuedOpen.current = null;
      try {
        if (!pending.current) return await run(action);
        return await new Promise<boolean>((resolve) => {
          queuedClose.current = { action, resolve };
        });
      } finally {
        closing.current = false;
      }
    },
    [run],
  );

  return { busy, run, runClose, finishHostAction };
}

export function sameProjectPath(left: string, right: string): boolean {
  const windowsPath = /^(?:[a-z]:[\\/]|[\\/]{2})/i;
  if (!windowsPath.test(left) || !windowsPath.test(right)) return left === right;
  const normalize = (path: string) =>
    path
      .replaceAll('\\', '/')
      .replace(/^\/\/\?\/(?=[a-z]:\/)/i, '')
      .toLowerCase();
  return normalize(left) === normalize(right);
}

export function useWorkbenchHost(
  host: AppHost,
  open: (path: string) => void,
  requestClose: () => Promise<boolean>,
  discarding: RefObject<boolean>,
  reportError: (message: string) => void,
) {
  const engine = useEngine();
  const projects = useProjects();
  useEffect(() => host.onOpenPath(open), [host, open]);
  useEffect(() => host.onCloseRequested(requestClose), [host, requestClose]);

  useEffect(() => {
    if (!host.protectBeforeUnload) return;
    let unsaved = false;
    const stop = projects.status((status) => {
      unsaved = status.state !== 'saved';
    });
    const unprotect = host.protectBeforeUnload(
      () => !discarding.current && Boolean(engine.snapshot().sessionId) && unsaved,
    );
    return () => {
      stop();
      unprotect();
    };
  }, [host, engine, projects, discarding]);

  return () => {
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
    void host.saveDiagnostics(summary).catch(() => reportError(et.error.root));
  };
}
