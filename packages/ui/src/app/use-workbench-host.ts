import { useEffect, type RefObject } from 'react';
import { useEngine, useProjects } from '@pcbk/client';
import type { AppHost } from '@pcbk/contracts';

export function useWorkbenchHost(
  host: AppHost,
  open: (path: string) => void,
  requestClose: () => Promise<boolean>,
  discarding: RefObject<boolean>,
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
}
