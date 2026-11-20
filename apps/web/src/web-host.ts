import type { createWebRepository } from '@pcbk/adapters';
import type { AppHost } from '@pcbk/contracts';

type ProjectIndex = Pick<
  ReturnType<typeof createWebRepository>,
  'recents' | 'removeRecent' | 'listProjects'
>;

const noSubscription = () => () => undefined;
const reload = () => window.location.reload();

function downloadFile(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
      downloadFile('pcbk-diagnostika.json', new Blob([summary], { type: 'application/json' }));
    },
    async saveTextFile(suggestedName, contents) {
      downloadFile(suggestedName, new Blob([contents], { type: 'text/csv;charset=utf-8' }));
      return 'saved';
    },
  };
}
