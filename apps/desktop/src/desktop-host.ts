import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open, save } from '@tauri-apps/plugin-dialog';
import { info } from '@tauri-apps/plugin-log';
import type { RecentDto } from '@pcbk/adapters';
import type { AppHost, Unsubscribe } from '@pcbk/contracts';

const projectFilter = { name: 'PCB Kaardistaja projekt', extensions: ['pcbk'] };

function recoveryName(path: string): string {
  const name = path
    .replaceAll('\\', '/')
    .split('/')
    .at(-1)
    ?.replace(/\.pcbk$/i, '');
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${name} (päästekoopia ${date} ${time})`;
}

export function createDesktopHost(warn: (message: string) => void): AppHost {
  const windowHandle = getCurrentWindow();
  const report = (error: unknown) => warn(`Desktop host: ${String(error)}`);

  function subscribe(start: (active: () => boolean) => Promise<Unsubscribe>): Unsubscribe {
    let active = true;
    let unlisten: Unsubscribe | undefined;
    void start(() => active)
      .then((stop) => {
        if (active) unlisten = stop;
        else stop();
      })
      .catch(report);
    return () => {
      active = false;
      unlisten?.();
    };
  }

  return {
    kind: 'desktop',
    async recents() {
      const records = await invoke<RecentDto[]>('recent_list');
      return records.map((record) => ({
        path: record.path,
        projectId: record.project_id,
        name: record.name,
        updatedAt: record.opened_at,
        missing: !record.exists,
      }));
    },
    removeRecent: (path) => invoke<void>('recent_remove', { path }),
    pickProjectFile: () => open({ multiple: false, directory: false, filters: [projectFilter] }),
    async pickSavePath(suggestedName) {
      const defaultPath = await invoke<string>('default_project_path', { name: suggestedName });
      return save({ defaultPath, filters: [projectFilter] });
    },
    recoveryCopyPath: (near) =>
      invoke<string>('default_project_path', { name: recoveryName(near), near }),
    onCloseRequested(handler) {
      return subscribe((active) =>
        windowHandle.onCloseRequested(async (event) => {
          if (!active()) return;
          event.preventDefault();
          try {
            if ((await handler()) && active()) await windowHandle.destroy();
          } catch (error) {
            report(error);
          }
        }),
      );
    },
    onOpenPath(handler) {
      return subscribe(async (active) => {
        // Install the listener first so a second launch cannot fall between it
        // and the one-time handoff of the initial command-line path.
        let buffered: string[] | null = [];
        const unlisten = await listen<string>('project:open-path', ({ payload }) => {
          if (!active()) return;
          if (buffered) buffered.push(payload);
          else handler(payload);
        });
        try {
          const initial = await invoke<string | null>('take_initial_path');
          if (initial && active()) handler(initial);
        } catch (error) {
          report(error);
        }
        const paths = buffered;
        buffered = null;
        if (active()) for (const path of paths) handler(path);
        return unlisten;
      });
    },
    closeNow() {
      void windowHandle.destroy().catch(report);
    },
    reload() {
      window.location.reload();
    },
    async saveDiagnostics(summary) {
      const dest = await save({
        defaultPath: 'pcbk-diagnostika.txt',
        filters: [{ name: 'Tekstifail', extensions: ['txt'] }],
      });
      if (!dest) return;
      await info(summary).catch(report);
      await invoke<void>('log_export', { dest });
    },
  };
}
