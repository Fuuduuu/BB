import { newBoardDoc } from '@pcbk/domain';
import { err, ok } from '@pcbk/contracts';
import type {
  DocumentEngine,
  DomainEvent,
  ProjectService,
  SaveStatus,
  Snapshot,
} from '@pcbk/contracts';

export function snapshot(sessionId = 'session-a', rev = 0, name = 'Board'): Snapshot {
  return Object.freeze({
    sessionId,
    rev,
    doc: Object.freeze({ ...newBoardDoc(name), rev }),
    derived: Object.freeze({ unplacedBoard: [], unplacedSchematic: [], pinReadings: {} }),
    history: Object.freeze({ canUndo: false, canRedo: false }),
  });
}
export class FakeEngine implements DocumentEngine {
  readonly listeners = new Set<(value: Snapshot) => void>();
  readonly eventListeners = new Set<(value: DomainEvent) => void>();
  constructor(private value: Snapshot = snapshot()) {}
  snapshot() {
    return this.value;
  }
  subscribe(fn: (value: Snapshot) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  events(fn: (value: DomainEvent) => void) {
    this.eventListeners.add(fn);
    return () => {
      this.eventListeners.delete(fn);
    };
  }
  execute() {
    return ok({ rev: this.value.rev });
  }
  undo() {
    return err({ code: 'not_found', id: 'undo' } as const);
  }
  redo() {
    return err({ code: 'not_found', id: 'redo' } as const);
  }
  replace(value: Snapshot) {
    this.value = value;
    this.ping();
  }
  ping(value = this.value) {
    for (const fn of [...this.listeners]) fn(value);
  }
}
export type SaveNotice = SaveStatus & { sessionId: string };
const unavailable = async () => err({ code: 'stale_session' } as const);
export class FakeProjects implements ProjectService {
  readonly listeners = new Set<(value: SaveNotice) => void>();
  private latest: SaveNotice | null = null;
  create = unavailable;
  open = unavailable;
  copy = unavailable;
  backups = unavailable;
  restore = unavailable;
  importPhoto = unavailable;
  close = async () => ok(undefined);
  discard = async () => ok(undefined);
  flush = async () => ok(undefined);
  saveView() {}
  photoUrl: ProjectService['photoUrl'] = () => null;
  status(fn: (value: SaveNotice) => void) {
    this.listeners.add(fn);
    if (this.latest) fn(this.latest);
    return () => {
      this.listeners.delete(fn);
    };
  }
  emit(value: SaveNotice) {
    this.latest = value;
    for (const fn of [...this.listeners]) fn(value);
  }
}
export const saved = (sessionId = 'session-a', rev = 0): SaveNotice => ({
  sessionId,
  state: 'saved',
  rev,
  at: '2026-11-08T10:00:00.000Z',
});
