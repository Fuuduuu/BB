import type { JournalEntry, OpenedProject, ProjectRepository } from '@pcbk/engine';
import { StorageError } from '@pcbk/engine';
import type { RecentProject, ViewState } from '@pcbk/contracts';
import { parseViewState } from '@pcbk/contracts';
import { createStore, entries, get, update } from 'idb-keyval';
import type { UseStore } from 'idb-keyval';

type WebProject = {
  meta: {
    format_version: number;
    project_id: string;
    file_id?: string;
    created_at: string;
    updated_at?: string;
    app_version: string;
  };
  doc: { format_version: number; rev: number; name: string; device?: string };
  rev: number;
  view: ViewState | null;
  journal: JournalEntry[];
};
const recentKey = 'bb:recent-projects';
let sessionSequence = 0;
const clone = <T>(value: T): T => structuredClone(value);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const revision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function journalEntry(value: unknown): value is JournalEntry {
  return (
    object(value) &&
    typeof value.at === 'string' &&
    (value.kind === 'command' || value.kind === 'undo' || value.kind === 'redo') &&
    typeof value.commandId === 'string' &&
    value.source === 'user' &&
    typeof value.summary === 'string' &&
    (value.requestId === undefined || typeof value.requestId === 'string')
  );
}
function project(value: unknown, path: string): WebProject {
  if (value === undefined) throw new StorageError('missing');
  if (
    !object(value) ||
    !object(value.meta) ||
    !object(value.doc) ||
    !revision(value.rev) ||
    !revision(value.meta.format_version) ||
    typeof value.meta.project_id !== 'string' ||
    !value.meta.project_id ||
    (value.meta.file_id !== undefined &&
      (typeof value.meta.file_id !== 'string' || !value.meta.file_id)) ||
    path !== `web://${value.meta.project_id}` ||
    typeof value.meta.created_at !== 'string' ||
    (value.meta.updated_at !== undefined && typeof value.meta.updated_at !== 'string') ||
    typeof value.meta.app_version !== 'string' ||
    value.doc.rev !== value.rev ||
    value.doc.format_version !== value.meta.format_version ||
    typeof value.doc.name !== 'string' ||
    (value.doc.device !== undefined && typeof value.doc.device !== 'string') ||
    !Array.isArray(value.journal) ||
    !value.journal.every(journalEntry)
  )
    throw new StorageError('not_project');
  return value as WebProject;
}
function storageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const name = object(error) ? error.name : undefined;
  if (name === 'QuotaExceededError') return new StorageError('disk_full');
  if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'ReadOnlyError')
    return new StorageError('read_only');
  if (name === 'NotFoundError') return new StorageError('missing');
  return new StorageError('unknown');
}
async function guard<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw storageError(error);
  }
}
function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
function recent(value: unknown): value is RecentProject {
  return (
    object(value) &&
    typeof value.projectId === 'string' &&
    !!value.projectId &&
    value.path === `web://${value.projectId}` &&
    typeof value.name === 'string' &&
    typeof value.updatedAt === 'string' &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    (value.device === undefined || typeof value.device === 'string')
  );
}

export function createWebRepository(
  options: {
    store?: UseStore;
    recentStorage?: Storage;
    now?: () => string;
  } = {},
): ProjectRepository & {
  recents(): RecentProject[];
  removeRecent(path: string): void;
  listProjects(): Promise<RecentProject[]>;
} {
  const store = options.store ?? createStore('bb-projects', 'projects');
  const recentStorage = options.recentStorage ?? browserStorage();
  const now = options.now ?? (() => new Date().toISOString());
  const sessions = new Map<string, string>();
  let recentCache: RecentProject[] = [];
  let recentUnavailable = !recentStorage;
  const recents = (): RecentProject[] => {
    if (!recentUnavailable) {
      try {
        const parsed: unknown = JSON.parse(recentStorage!.getItem(recentKey) ?? '[]');
        const paths = new Set<string>();
        recentCache = Array.isArray(parsed)
          ? parsed
              .filter((value): value is RecentProject => {
                if (!recent(value) || paths.has(value.path)) return false;
                paths.add(value.path);
                return true;
              })
              .slice(0, 20)
          : [];
      } catch (error) {
        if (error instanceof SyntaxError) recentCache = [];
        else recentUnavailable = true;
      }
    }
    return clone(recentCache);
  };
  const writeRecents = (items: RecentProject[]) => {
    recentCache = items;
    // Project durability is independent from this best-effort navigation index.
    if (!recentUnavailable) {
      try {
        recentStorage!.setItem(recentKey, JSON.stringify(items));
      } catch {
        recentUnavailable = true;
      }
    }
  };
  const remember = (path: string, value: WebProject) => {
    try {
      writeRecents(
        [
          {
            path,
            projectId: value.meta.project_id,
            name: value.doc.name,
            ...(value.doc.device === undefined ? {} : { device: value.doc.device }),
            updatedAt: value.meta.updated_at ?? value.meta.created_at,
          },
          ...recents().filter((item) => item.path !== path),
        ].slice(0, 20),
      );
    } catch {
      /* A navigation-index failure must never turn a committed write into a retry. */
    }
  };
  const sessionPath = (session: string) => {
    const path = sessions.get(session);
    if (!path) throw new StorageError('missing');
    return path;
  };
  const opened = (path: string, value: WebProject): OpenedProject => {
    if (!value.meta.file_id) throw new StorageError('not_project');
    const session = `web-session-${++sessionSequence}`;
    sessions.set(session, path);
    return {
      session,
      path,
      projectId: value.meta.project_id,
      fileId: value.meta.file_id,
      doc: clone(value.doc),
      view: parseViewState(value.view),
      formatVersion: value.meta.format_version,
      readOnly: false,
      savedAt: value.meta.updated_at ?? value.meta.created_at,
    };
  };
  const unsupported = async (): Promise<never> => {
    throw new StorageError('unknown');
  };
  const repository: ProjectRepository = {
    create(req) {
      return guard(async () => {
        const captured = clone(req);
        const path = `web://${captured.projectId}`;
        if (!captured.projectId || (captured.path !== undefined && captured.path !== path))
          throw new StorageError('unknown');
        const at = now();
        const value: WebProject = {
          meta: {
            format_version: captured.doc.format_version,
            project_id: captured.projectId,
            file_id: crypto.randomUUID(),
            created_at: at,
            updated_at: at,
            app_version: '0.0.0',
          },
          doc: captured.doc,
          rev: captured.doc.rev,
          view: null,
          journal: [],
        };
        project(value, path);
        await update<unknown>(
          `project:${path}`,
          (current) => {
            if (current !== undefined) throw new StorageError('unknown');
            return value;
          },
          store,
        );
        remember(path, value);
        return opened(path, value);
      });
    },
    open(path) {
      return guard(async () => {
        let value = project(await get<unknown>(`project:${path}`, store), path);
        if (value.meta.file_id === undefined) {
          await update<unknown>(
            `project:${path}`,
            (current) => {
              value = project(current, path);
              if (value.meta.file_id === undefined)
                value = { ...value, meta: { ...value.meta, file_id: crypto.randomUUID() } };
              return value;
            },
            store,
          );
        }
        remember(path, value);
        return opened(path, value);
      });
    },
    save(req) {
      return guard(async () => {
        const captured = clone(req);
        const path = sessionPath(captured.session);
        let saved: WebProject | undefined;
        await update<unknown>(
          `project:${path}`,
          (current) => {
            sessionPath(captured.session);
            const value = project(current, path);
            if (value.rev !== captured.baseRev) throw new StorageError('unknown', value.rev);
            if (
              captured.doc.rev !== captured.rev ||
              !revision(captured.rev) ||
              captured.rev < captured.baseRev
            )
              throw new StorageError('unknown');
            saved = {
              ...value,
              meta: {
                ...value.meta,
                format_version: captured.doc.format_version,
                updated_at: now(),
              },
              doc: captured.doc,
              rev: captured.rev,
              journal: [...value.journal, ...captured.journal],
            };
            project(saved, path);
            return saved;
          },
          store,
        );
        remember(path, saved!);
      });
    },
    saveView(session, view) {
      return guard(async () => {
        const captured = parseViewState(view);
        if (!captured) throw new StorageError('unknown');
        const path = sessionPath(session);
        await update<unknown>(
          `project:${path}`,
          (current) => {
            sessionPath(session);
            const value = { ...project(current, path), view: captured };
            return project(value, path);
          },
          store,
        );
      });
    },
    copy: unsupported,
    backupFull: unsupported,
    backups: unsupported,
    restore: unsupported,
    async close(session) {
      sessions.delete(session);
    },
  };
  return {
    ...repository,
    recents,
    listProjects() {
      return guard(async () => {
        const stored = await entries<IDBValidKey, unknown>(store);
        const result: RecentProject[] = [];
        for (const [key, raw] of stored) {
          if (typeof key !== 'string' || !key.startsWith('project:')) continue;
          const path = key.slice('project:'.length);
          let value: WebProject;
          try {
            value = project(raw, path);
          } catch {
            continue;
          }
          result.push({
            path,
            projectId: value.meta.project_id,
            name: value.doc.name,
            ...(value.doc.device === undefined ? {} : { device: value.doc.device }),
            // Older records predate the optional modification timestamp.
            updatedAt: value.meta.updated_at ?? value.meta.created_at,
          });
        }
        return result;
      });
    },
    removeRecent(path) {
      writeRecents(recents().filter((item) => item.path !== path));
    },
  };
}
