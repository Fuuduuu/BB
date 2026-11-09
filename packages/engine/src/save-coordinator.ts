import { SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS } from '@pcbk/domain';
import { err, ok } from '@pcbk/contracts';
import type { DocumentEngine, EngineError, Result, SaveStatus, ViewState } from '@pcbk/contracts';
import { StorageError } from './ports';
import type { ProjectRepository } from './ports';
import type { Clock, EngineHost } from './types';
import { sealTree } from './immutability';

export type SaveNotice = SaveStatus & { sessionId: string };
export function storageFailure(error: unknown, expected?: number): EngineError {
  if (error instanceof StorageError) {
    if (error.actualRev !== undefined && expected !== undefined)
      return { code: 'stale_rev', expected, actual: error.actualRev };
    return { code: 'storage', reason: error.reason };
  }
  return { code: 'storage', reason: 'unknown' };
}
type Outcome = Result<void, EngineError>;

export function saveTiming(input?: { debounceMs: number; maxWaitMs: number }) {
  const timing = { ...(input ?? { debounceMs: SAVE_DEBOUNCE_MS, maxWaitMs: SAVE_MAX_WAIT_MS }) };
  if (![timing.debounceMs, timing.maxWaitMs].every((value) => Number.isFinite(value) && value > 0))
    throw new Error('invalid_save_timing');
  return timing;
}

export function createSaveCoordinator(opts: {
  engine: DocumentEngine;
  host: EngineHost;
  repo: ProjectRepository;
  clock: Clock;
  session: string;
  sessionId: string;
  baseRev: number;
  savedAt?: string;
  view: ViewState | null;
  needsSave?: boolean;
  readOnly?: boolean;
  timing?: { debounceMs: number; maxWaitMs: number };
  onStatus: (status: SaveNotice) => void;
}) {
  const timing = saveTiming(opts.timing);
  let baseRev = opts.baseRev;
  let force = opts.needsSave ?? false;
  let view = opts.view ? { ...opts.view } : null;
  let viewVersion = 0;
  let savedViewVersion = 0;
  let disposed = false;
  let paused = false;
  let changes = 0;
  let lastError: EngineError | null = null;
  let failureVersion: number | undefined;
  let running: Promise<Outcome> | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const active = () => !disposed && opts.host.current()?.sessionId === opts.sessionId;
  const dirty = () =>
    active() && (force || opts.host.current()!.rev !== baseRev || viewVersion !== savedViewVersion);
  const publish = (status: SaveStatus) => {
    if (active()) opts.onStatus(sealTree({ ...status, sessionId: opts.sessionId }));
  };
  const cancelTimers = () => {
    clearTimeout(debounce);
    clearTimeout(deadline);
    debounce = undefined;
    deadline = undefined;
  };
  function schedule() {
    if (paused || disposed || !dirty() || running) return;
    if (!lastError) publish({ state: 'pending' });
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      void flush();
    }, timing.debounceMs);
    deadline ??= setTimeout(() => {
      void flush();
    }, timing.maxWaitMs);
  }
  function changed() {
    changes++;
    schedule();
  }
  const unsubscribe = opts.engine.subscribe((snapshot) => {
    if (snapshot.sessionId !== opts.sessionId) {
      cancelTimers();
      return;
    }
    if (dirty()) changed();
  });

  async function run(): Promise<Outcome> {
    failureVersion = undefined;
    if (!lastError) publish({ state: 'saving' });
    while (dirty() && !paused) {
      const current = opts.host.current()!;
      const attemptedChanges = changes;
      if (force || current.rev !== baseRev) {
        const journal = opts.host.drainJournal();
        try {
          await opts.repo.save({
            session: opts.session,
            baseRev,
            rev: current.rev,
            doc: current.doc,
            journal,
          });
          baseRev = current.rev;
          force = false;
        } catch (error) {
          if (active()) opts.host.requeueJournal(journal);
          lastError = storageFailure(error, baseRev);
          failureVersion = attemptedChanges;
          publish({
            state: 'error',
            reason: lastError.code === 'storage' ? lastError.reason : 'unknown',
          });
          return err(lastError);
        }
      } else {
        const writingVersion = viewVersion;
        try {
          await opts.repo.saveView(opts.session, { ...view! });
          savedViewVersion = writingVersion;
        } catch (error) {
          lastError = storageFailure(error);
          failureVersion = attemptedChanges;
          publish({
            state: 'error',
            reason: lastError.code === 'storage' ? lastError.reason : 'unknown',
          });
          return err(lastError);
        }
      }
    }
    if (!active()) return err({ code: 'stale_session' });
    if (!dirty()) {
      lastError = null;
      publish({ state: 'saved', rev: baseRev, at: opts.clock.now() });
    }
    return ok(undefined);
  }
  async function flush(): Promise<Outcome> {
    cancelTimers();
    while (active() && !paused) {
      if (!running) {
        if (!dirty()) return ok(undefined);
        // Assign before executing user observers, which may themselves request a flush.
        running = Promise.resolve()
          .then(run)
          .catch((error: unknown) => {
            lastError = storageFailure(error);
            publish({
              state: 'error',
              reason: lastError.code === 'storage' ? lastError.reason : 'unknown',
            });
            return err(lastError);
          })
          .finally(() => {
            running = undefined;
            if (failureVersion !== undefined && changes > failureVersion) schedule();
          });
      }
      const result = await running;
      if (!result.ok) return result;
      // A saved observer may have synchronously issued one last command.
    }
    return err({ code: 'stale_session' });
  }
  if (dirty()) schedule();
  else publish({ state: 'saved', rev: baseRev, at: opts.savedAt ?? opts.clock.now() });
  return {
    flush,
    isClean: () => active() && !running && !dirty(),
    saveView(next: ViewState) {
      if (!active()) return;
      if (
        view?.navigatorWidth === next.navigatorWidth &&
        view.navigatorTab === next.navigatorTab &&
        view.contextWidth === next.contextWidth &&
        view.contextOpen === next.contextOpen
      )
        return;
      view = { ...next };
      // Read-only viewing remains local; a writable rescue copy can retain this view.
      if (opts.readOnly) return;
      viewVersion++;
      changed();
    },
    currentView: () => (view ? { ...view } : null),
    async pause(): Promise<Outcome> {
      paused = true;
      cancelTimers();
      return running ? await running : ok(undefined);
    },
    resume() {
      paused = false;
      schedule();
    },
    dispose() {
      disposed = true;
      cancelTimers();
      unsubscribe();
    },
  };
}
export type SaveCoordinator = ReturnType<typeof createSaveCoordinator>;
