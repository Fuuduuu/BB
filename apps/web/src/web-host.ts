import type { createWebRepository } from '@pcbk/adapters';
import type { AppHost } from '@pcbk/contracts';

type ProjectIndex = Pick<
  ReturnType<typeof createWebRepository>,
  'recents' | 'removeRecent' | 'listProjects'
>;

const noSubscription = () => () => undefined;
const reload = () => window.location.reload();

export function createWebHost(repo: ProjectIndex): AppHost {
  return {
    kind: 'web',
    recents: async () => repo.recents(),
    removeRecent: async (path) => repo.removeRecent(path),
    listOpenable: () => repo.listProjects(),
    onCloseRequested: noSubscription,
    onOpenPath: noSubscription,
    protectBeforeUnload(shouldWarn) {
      const warn = (event: BeforeUnloadEvent) => {
        if (!shouldWarn()) return;
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', warn);
      return () => window.removeEventListener('beforeunload', warn);
    },
    closeNow: reload,
    reload,
    async saveDiagnostics(summary) {
      const blob = new Blob([summary], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pcbk-diagnostika.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
