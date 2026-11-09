import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppHost, RecentProject } from '@pcbk/contracts';
import { et } from '../shell/i18n/et';

export function useProjectLists(
  host: AppHost,
  atHome: boolean,
  reportError: (message: string) => void,
) {
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [available, setAvailable] = useState<RecentProject[]>([]);
  const recentRequest = useRef(0);

  const refreshRecent = useCallback(async () => {
    const request = ++recentRequest.current;
    const items = await host.recents();
    if (request === recentRequest.current) setRecent(items);
  }, [host]);

  useEffect(() => {
    let active = true;
    void refreshRecent().catch(() => {
      if (active) reportError(et.error.root);
    });
    return () => {
      active = false;
      recentRequest.current += 1;
    };
  }, [refreshRecent, reportError]);

  useEffect(() => {
    if (!atHome || !host.listOpenable) return;
    let active = true;
    void host
      .listOpenable()
      .then((list) => {
        if (active) setAvailable(list);
      })
      .catch(() => {
        if (active) reportError(et.project.openFailed);
      });
    return () => {
      active = false;
    };
  }, [host, atHome, recent, reportError]);

  return { recent, available: host.listOpenable ? available : [], refreshRecent };
}
