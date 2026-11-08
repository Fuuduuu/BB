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
      setEntry({ engine, projects, sessionId, status: Object.freeze(notice) });
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
