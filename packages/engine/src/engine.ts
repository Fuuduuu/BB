import type { BoardDoc, DocKey } from '@pcbk/domain';
import { err, ok } from '@pcbk/contracts';
import type {
  CommandOk,
  DocumentEngine,
  DomainEvent,
  EngineError,
  Result,
  Snapshot,
} from '@pcbk/contracts';
import { enablePatches, Immer } from 'immer';
import { z, ZodError } from 'zod';
import { createSnapshotBuilder } from './derivation';
import { capturePayload, notify } from './events';
import { CommandTargetNotFound } from './errors';
import { createHistory } from './history';
import { sealTree } from './immutability';
import type { HistoryEntry } from './history';
import { validateDocument } from './invariants';
import { coreItems } from './items';
import { createJournal } from './journal';
import { ownershipError } from './ownership';
import { buildRegistry } from './registry';
import type { Clock, EngineHost, EngineModule, JournalEntry, PendingEvent } from './types';

enablePatches();
const producer = new Immer({ autoFreeze: true });
const executeOptions = z.strictObject({ requestId: z.string().optional() }).optional();
type CommandResult = Result<CommandOk, EngineError>;
type Active = {
  sessionId: string;
  doc: BoardDoc;
  readOnly: boolean;
  history: ReturnType<typeof createHistory>;
  journal: ReturnType<typeof createJournal>;
};
const validation = (error: unknown): CommandResult =>
  err({
    code: 'validation',
    issues:
      error instanceof ZodError
        ? error.issues
        : [
            {
              code: 'custom',
              path: [],
              message: error instanceof Error ? error.message : 'command_failed',
            },
          ],
  });

export function createEngine(opts: {
  modules: EngineModule[];
  clock: Clock;
  reserved?: DocKey[];
}): { engine: DocumentEngine; host: EngineHost } {
  const registry = buildRegistry([...opts.modules, coreItems], opts.reserved);
  const { empty, makeSnapshot } = createSnapshotBuilder(registry.derive, createHistory().status());
  let snapshot = empty;
  let active: Active | null = null;
  let busy = false;
  const subscribers = new Set<(value: Snapshot) => void>();
  const events = new Set<(value: DomainEvent) => void>();

  function locked(action: (state: Active) => CommandResult): CommandResult {
    if (busy) return validation(new Error('engine_busy'));
    if (!active) return err({ code: 'stale_session' });
    busy = true;
    try {
      return action(active);
    } catch (error) {
      if (error instanceof CommandTargetNotFound) return err({ code: 'not_found', id: error.id });
      return validation(error);
    } finally {
      busy = false;
    }
  }

  function commit(
    state: Active,
    next: BoardDoc,
    entry: HistoryEntry,
    kind: JournalEntry['kind'],
    pending: PendingEvent[] = [],
    requestId?: string,
  ): CommandResult {
    const rev = state.doc.rev + 1;
    if (!Number.isSafeInteger(rev)) throw new Error('revision_overflow');
    const doc = sealTree(
      producer.produce(next, (draft) => {
        draft.rev = rev;
      }),
    );
    const prepared = makeSnapshot(
      state.sessionId,
      doc,
      state.history.projectedStatus(kind),
      snapshot,
    );
    const at = z.iso.datetime().parse(opts.clock.now());
    const summary = z.string().parse(entry.summary);
    const emitted = pending.map((event) => sealTree({ ...event, sessionId: state.sessionId, rev }));
    const journalEntry = sealTree({
      at,
      kind,
      commandId: entry.commandId,
      source: 'user' as const,
      summary,
      ...(requestId === undefined ? {} : { requestId }),
    });
    sealTree(entry);
    // Everything that can reject the transaction is prepared before publishing any state.
    state.doc = doc;
    if (kind === 'command') state.history.record(entry);
    else if (kind === 'undo') state.history.didUndo();
    else state.history.didRedo();
    state.journal.append(journalEntry);
    snapshot = prepared;
    notify(subscribers, snapshot);
    for (const event of emitted) notify(events, event);
    return ok({ rev });
  }

  const engine: DocumentEngine = {
    execute(id, params, options) {
      return locked((state) => {
        const registered = registry.commands.get(id);
        if (!registered) return err({ code: 'not_found', id });
        const { spec } = registered;
        const parsed = spec.params.safeParse(params);
        if (!parsed.success) return err({ code: 'validation', issues: parsed.error.issues });
        const metadata = executeOptions.safeParse(options);
        if (!metadata.success) return err({ code: 'validation', issues: metadata.error.issues });
        if (state.readOnly) return err({ code: 'read_only' });
        const pending: PendingEvent[] = [];
        const [next, patches, inversePatches] = producer.produceWithPatches(state.doc, (draft) => {
          const returned: unknown = spec.run(draft, parsed.data, {
            derived: snapshot.derived,
            emit(event) {
              z.string()
                .regex(/^[^.]+\..+$/)
                .parse(event.type);
              pending.push({ type: event.type, payload: capturePayload(event.payload) });
            },
          });
          if (returned !== null && typeof returned === 'object' && 'then' in returned) {
            void Promise.resolve(returned).catch(() => undefined);
            throw new Error('async_command');
          }
        });
        const denied = ownershipError(id, patches, registered.fields, registry.reserved);
        if (denied) return err(denied);
        if (patches.length === 0) return ok({ rev: state.doc.rev });
        validateDocument(next);
        sealTree(next);
        const summary = spec.summary ? spec.summary(parsed.data, next) : spec.title;
        return commit(
          state,
          next,
          { patches, inversePatches, commandId: id, summary },
          'command',
          pending,
          metadata.data?.requestId,
        );
      });
    },
    undo() {
      return travel('undo');
    },
    redo() {
      return travel('redo');
    },
    snapshot: () => snapshot,
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    events(fn) {
      events.add(fn);
      return () => {
        events.delete(fn);
      };
    },
  };

  function travel(kind: 'undo' | 'redo'): CommandResult {
    return locked((state) => {
      if (state.readOnly) return err({ code: 'read_only' });
      const entry = kind === 'undo' ? state.history.undoEntry() : state.history.redoEntry();
      if (!entry) return err({ code: 'not_found', id: kind });
      const next = producer.applyPatches(
        state.doc,
        kind === 'undo' ? entry.inversePatches : entry.patches,
      );
      validateDocument(next);
      return commit(state, next, entry, kind);
    });
  }

  const host: EngineHost = {
    load(sessionId, input, readOnly) {
      if (busy) throw new Error('engine_busy');
      busy = true;
      try {
        z.string().min(1).parse(sessionId);
        const doc = sealTree(validateDocument(input));
        const history = createHistory();
        const prepared = makeSnapshot(sessionId, doc, history.status());
        active = { sessionId, doc, readOnly, history, journal: createJournal() };
        snapshot = prepared;
        notify(subscribers, snapshot);
      } finally {
        busy = false;
      }
    },
    unload() {
      if (busy) throw new Error('engine_busy');
      busy = true;
      try {
        active = null;
        snapshot = empty;
        notify(subscribers, snapshot);
      } finally {
        busy = false;
      }
    },
    current() {
      return active ? { sessionId: active.sessionId, rev: active.doc.rev, doc: active.doc } : null;
    },
    drainJournal() {
      return active?.journal.drain() ?? [];
    },
    requeueJournal(entries) {
      active?.journal.requeue(entries);
    },
  };
  return { engine, host };
}
