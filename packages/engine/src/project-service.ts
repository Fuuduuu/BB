import { BoardDocSchema, CURRENT_FORMAT_VERSION, migrateDoc, newBoardDoc } from '@pcbk/domain';
import type { BoardDoc } from '@pcbk/domain';
import { err, ok, parseViewState } from '@pcbk/contracts';
import type {
  DocumentEngine,
  EngineError,
  IdGen,
  ProjectInfo,
  ProjectService,
  Result,
} from '@pcbk/contracts';
import { z } from 'zod';
import { StorageError } from './ports';
import type { OpenedProject, ProjectRepository } from './ports';
import type { Clock, EngineHost } from './types';
import { createSaveCoordinator, saveTiming, storageFailure } from './save-coordinator';
import type { SaveCoordinator, SaveNotice } from './save-coordinator';
import { validateDocument } from './invariants';
import { notify } from './events';
import { sealTree } from './immutability';

const createSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  device: z.string().optional(),
  problem: z.string().optional(),
  path: z.string().min(1).optional(),
});
const openSchema = z.strictObject({ path: z.string().min(1) });
const copySchema = z.strictObject({ dest: z.string().min(1), identity: z.enum(['same', 'new']) });
const restoreSchema = z.strictObject({ backup: z.string().min(1), dest: z.string().min(1) });
type Context = { opened: OpenedProject; sessionId: string; saver: SaveCoordinator };

export function createProjectService(opts: {
  engine: DocumentEngine;
  host: EngineHost;
  repo: ProjectRepository;
  clock: Clock;
  ids: IdGen;
  timing?: { debounceMs: number; maxWaitMs: number };
}): ProjectService {
  const timing = saveTiming(opts.timing);
  let active: Context | null = null;
  let latest: SaveNotice | null = null;
  let lastSaveNotice: SaveNotice | null = null;
  let releaseError: EngineError | null = null;
  const pendingReleases = new Set<string>();
  let queue = Promise.resolve();
  const listeners = new Set<(status: SaveNotice) => void>();
  function display(status: SaveNotice) {
    lastSaveNotice = status;
    latest = releaseError
      ? sealTree({
          state: 'error',
          sessionId: status.sessionId,
          reason: releaseError.code === 'storage' ? releaseError.reason : 'unknown',
        })
      : status;
    notify(listeners, latest);
  }
  async function releasePending(strict: boolean) {
    let cause: unknown;
    let failed = false;
    for (const session of [...pendingReleases]) {
      try {
        await opts.repo.close(session);
        pendingReleases.delete(session);
      } catch (error) {
        cause = error;
        failed = true;
      }
    }
    releaseError = failed ? storageFailure(cause) : null;
    if (!active && pendingReleases.size === 0) {
      latest = null;
      lastSaveNotice = null;
    } else if (lastSaveNotice) display(lastSaveNotice);
    if (strict && failed) throw cause;
  }
  async function retire(session: string) {
    pendingReleases.add(session);
    await releasePending(false);
  }
  function serial<T>(
    action: () => Promise<Result<T, EngineError>>,
    strictRelease = false,
  ): Promise<Result<T, EngineError>> {
    const work = queue
      .then(async () => {
        await releasePending(strictRelease);
        return action();
      })
      .catch((error: unknown) =>
        err<EngineError>(
          error instanceof z.ZodError
            ? { code: 'validation', issues: error.issues }
            : storageFailure(error),
        ),
      );
    queue = work.then(() => undefined);
    return work;
  }
  const info = (context: Context): ProjectInfo => ({
    projectId: context.opened.projectId,
    path: context.opened.path,
    sessionId: context.sessionId,
    name: opts.host.current()!.doc.name,
    readOnly: context.opened.readOnly,
    view: context.saver.currentView(),
  });
  function coordinate(
    opened: OpenedProject,
    sessionId: string,
    baseRev: number,
    needsSave: boolean,
    carriedView?: OpenedProject['view'],
  ) {
    const context = { opened, sessionId } as Context;
    active = context;
    let ready = false;
    let initial: SaveNotice | undefined;
    const publish = (status: SaveNotice) => {
      if (active !== context || opts.host.current()?.sessionId !== status.sessionId) return;
      if (!ready) {
        initial = status;
        return;
      }
      display(status);
    };
    context.saver = createSaveCoordinator({
      ...opts,
      timing,
      session: opened.session,
      sessionId,
      baseRev,
      savedAt: opened.savedAt,
      needsSave,
      view: opened.view,
      readOnly: opened.readOnly,
      onStatus: publish,
    });
    if (carriedView) context.saver.saveView(carriedView);
    ready = true;
    if (initial) publish(initial);
    return context;
  }
  async function prepare(
    opened: OpenedProject,
  ): Promise<{ doc: BoardDoc; baseRev: number; migrated: boolean }> {
    const version = opened.formatVersion;
    if (!Number.isSafeInteger(version) || version < 0) throw new StorageError('not_project');
    if (version > CURRENT_FORMAT_VERSION) throw new StorageError('too_new');
    const header = z
      .object({ format_version: z.literal(version), rev: z.number().int().nonnegative() })
      .safeParse(opened.doc);
    if (!header.success) throw new StorageError('not_project');
    const migrated = version < CURRENT_FORMAT_VERSION;
    if (migrated && opened.readOnly) throw new StorageError('read_only');
    if (migrated) await opts.repo.backupFull(opened.session, 'migration');
    const raw = migrateDoc(opened.doc, version);
    try {
      const doc = validateDocument(BoardDocSchema.parse(raw));
      opened.view = parseViewState(opened.view);
      return { doc, baseRev: header.data.rev, migrated };
    } catch {
      throw new StorageError('not_project');
    }
  }
  async function acquire(
    open: () => Promise<OpenedProject>,
  ): Promise<Result<ProjectInfo, EngineError>> {
    const before = active;
    if (before) {
      const saved = await before.saver.flush();
      if (!saved.ok) return saved;
    }
    const opened = await open();
    try {
      const prepared = await prepare(opened);
      // Input may continue during open/migration: flush the previous project's newest state.
      if (before) {
        do {
          const saved = await before.saver.flush();
          if (!saved.ok) {
            await retire(opened.session);
            return saved;
          }
        } while (!before.saver.isClean());
      }
      const sessionId = opts.ids.newId('session');
      opts.host.load(sessionId, prepared.doc, opened.readOnly);
      before?.saver.dispose();
      const context = coordinate(opened, sessionId, prepared.baseRev, prepared.migrated);
      if (before) await retire(before.opened.session);
      return ok(info(context));
    } catch (error) {
      if (active?.opened.session !== opened.session) await retire(opened.session);
      throw error;
    }
  }
  async function unload(context: Context) {
    // Stop new document commands before awaiting asynchronous handle release.
    context.saver.dispose();
    active = null;
    opts.host.unload();
    pendingReleases.add(context.opened.session);
    await releasePending(true);
    return ok(undefined);
  }
  return {
    create(req) {
      return serial(async () => {
        const params = createSchema.parse(req);
        return acquire(() => {
          const doc = newBoardDoc(params.name);
          if (params.device !== undefined) doc.device = params.device;
          if (params.problem !== undefined) doc.problem = params.problem;
          return opts.repo.create({ ...params, projectId: opts.ids.newId('project'), doc });
        });
      });
    },
    open(req) {
      return serial(async () => {
        const { path } = openSchema.parse(req);
        if (active?.opened.path === path) return ok(info(active));
        return acquire(() => opts.repo.open(path));
      });
    },
    flush() {
      return serial(async () => (active ? active.saver.flush() : ok(undefined)), true);
    },
    close() {
      return serial(async () => {
        if (!active) return ok(undefined);
        const context = active;
        do {
          const saved = await context.saver.flush();
          if (!saved.ok) return saved;
        } while (!context.saver.isClean());
        return unload(context);
      }, true);
    },
    discard() {
      return serial(async () => {
        const context = active;
        if (context) {
          // An in-flight write must settle before releasing its storage handle.
          // Pause cancels the timers and prevents the saver from starting a follow-up write.
          await context.saver.pause();
          return unload(context);
        }
        await releasePending(true);
        return ok(undefined);
      });
    },
    saveView(view) {
      const parsed = parseViewState(view);
      if (parsed) active?.saver.saveView(parsed);
    },
    status(listener) {
      listeners.add(listener);
      if (latest) notify(new Set([listener]), latest);
      return () => {
        listeners.delete(listener);
      };
    },
    copy(req) {
      return serial(async () => {
        const params = copySchema.parse(req);
        if (!active) return err({ code: 'stale_session' });
        const before = active;
        await before.saver.pause(); // A failed source save must not prevent a rescue copy.
        const current = opts.host.current()!;
        const journal = opts.host.drainJournal();
        const copiedView = before.saver.currentView();
        let opened: OpenedProject;
        try {
          opened = await opts.repo.copy({
            ...params,
            session: before.opened.session,
            doc: current.doc,
            rev: current.rev,
            view: copiedView,
            journal,
            projectId:
              params.identity === 'same' ? before.opened.projectId : opts.ids.newId('project'),
            ...(params.identity === 'new' ? { copiedFromProjectId: before.opened.projectId } : {}),
          });
        } catch (error) {
          opts.host.requeueJournal(journal);
          before.saver.resume();
          throw error;
        }
        const latestView = before.saver.currentView();
        before.saver.dispose();
        let sessionId = before.sessionId;
        if (before.opened.readOnly) {
          sessionId = opts.ids.newId('session');
          opts.host.load(sessionId, opts.host.current()!.doc, false);
        }
        // Keep the live document/history: commands made during copy are still pending.
        const context = coordinate(opened, sessionId, current.rev, false, latestView);
        await retire(before.opened.session);
        return ok(info(context));
      });
    },
    backups() {
      return serial(async () =>
        active
          ? ok(await opts.repo.backups(active.opened.projectId))
          : err({ code: 'stale_session' }),
      );
    },
    restore(req) {
      return serial(async () => {
        const params = restoreSchema.parse(req);
        return acquire(() => opts.repo.restore(params));
      });
    },
  };
}
