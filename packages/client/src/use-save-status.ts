import { useEffect, useState } from 'react';
import type { DocumentEngine, ProjectService, SaveStatus } from '@pcbk/contracts';
import { useEngine, useProjects } from './context';
import { isCurrentSession } from './session-filter';
import { useSnapshot } from './use-snapshot';

const pending: SaveStatus = Object.freeze({ state: 'pending' });
type Entry = {
  engine: DocumentEngine;
  projects: ProjectService;
  sessionId: string;
  status: SaveStatus;
};

function sameStatus(a: SaveStatus, b: SaveStatus): boolean {
  switch (a.state) {
    case 'saved':
      return b.state === 'saved' && a.rev === b.rev && a.at === b.at;
    case 'error':
      return b.state === 'error' && a.reason === b.reason;
    default:
      return a.state === b.state;
  }
}

export function useSaveStatus(): SaveStatus {
  const engine = useEngine();
  const projects = useProjects();
  const snapshot = useSnapshot((value) => value);
  const [entry, setEntry] = useState<Entry | null>(null);
  useEffect(() => {
    let listening = true;
    const unsubscribe = projects.status(({ sessionId, ...notice }) => {
      const current = engine.snapshot();
      if (!listening || !isCurrentSession(current.sessionId, sessionId)) return;
      if (notice.state === 'saved' && notice.rev < current.rev) return;
      setEntry((previous) => {
        if (
          previous?.engine === engine &&
          previous.projects === projects &&
          previous.sessionId === sessionId &&
          sameStatus(previous.status, notice)
        )
          return previous;
        return { engine, projects, sessionId, status: Object.freeze(notice) };
      });
    });
    return () => {
      listening = false;
      unsubscribe();
    };
  }, [engine, projects]);
  if (
    !entry ||
    entry.engine !== engine ||
    entry.projects !== projects ||
    !isCurrentSession(snapshot.sessionId, entry.sessionId)
  )
    return pending;
  if (entry.status.state === 'saved' && entry.status.rev < snapshot.rev) return pending;
  return entry.status;
}
