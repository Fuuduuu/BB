import { StorageError } from '@pcbk/engine';
import type { ProjectRepository } from '@pcbk/engine';
import type { BackupInfo, StorageReason, ViewState } from '@pcbk/contracts';
import type { JournalEntry } from '@pcbk/engine';

export type MemoryProject = {
  projectId: string;
  copiedFromProjectId?: string;
  doc: unknown;
  rev: number;
  formatVersion: number;
  view: ViewState | null;
  journal: JournalEntry[];
  readOnly: boolean;
};
export type MemoryStore = {
  files: Map<string, MemoryProject>;
  locks: Map<string, string>;
  backups: Map<string, { info: BackupInfo; file: MemoryProject }>;
  sequence: number;
};
export function createMemoryStore(): MemoryStore {
  return { files: new Map(), locks: new Map(), backups: new Map(), sequence: 0 };
}
const clone = <T>(value: T): T =>
  value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

export function createMemoryRepository(store: MemoryStore = createMemoryStore()) {
  const sessions = new Map<string, string>();
  let failure: StorageReason | undefined;
  let documentWrites = 0;
  let viewWrites = 0;
  const checkFailure = () => {
    if (failure) {
      const reason = failure;
      failure = undefined;
      throw new StorageError(reason);
    }
  };
  const file = (session: string) => {
    const path = sessions.get(session);
    if (!path || store.locks.get(path) !== session) throw new StorageError('missing');
    const result = store.files.get(path);
    if (!result) throw new StorageError('missing');
    return result;
  };
  const writable = (session: string) => {
    checkFailure();
    const current = file(session);
    if (current.readOnly) throw new StorageError('read_only');
    return current;
  };
  const acquire = (path: string) => {
    if (store.locks.has(path)) throw new StorageError('locked');
    const current = store.files.get(path);
    if (!current) throw new StorageError('missing');
    const session = `memory-session-${++store.sequence}`;
    store.locks.set(path, session);
    sessions.set(session, path);
    return {
      session,
      path,
      projectId: current.projectId,
      doc: clone(current.doc),
      view: clone(current.view),
      formatVersion: current.formatVersion,
      readOnly: current.readOnly,
    };
  };
  const install = (path: string, value: MemoryProject) => {
    if (store.files.has(path)) throw new StorageError('unknown');
    store.files.set(path, clone(value));
    return acquire(path);
  };
  const repo: ProjectRepository = {
    async create(req) {
      checkFailure();
      return install(req.path ?? `memory://${req.projectId}.pcbk`, {
        projectId: req.projectId,
        doc: req.doc,
        rev: req.doc.rev,
        view: null,
        journal: [],
        formatVersion: req.doc.format_version,
        readOnly: false,
      });
    },
    async open(path) {
      checkFailure();
      return acquire(path);
    },
    async save(req) {
      const current = writable(req.session);
      if (current.rev !== req.baseRev) throw new StorageError('unknown', current.rev);
      if (req.doc.rev !== req.rev || req.rev < req.baseRev) throw new StorageError('unknown');
      const doc = clone(req.doc);
      const journal = clone([...current.journal, ...req.journal]);
      current.doc = doc;
      current.rev = req.rev;
      current.journal = journal;
      current.formatVersion = req.doc.format_version;
      documentWrites++;
    },
    async saveView(session, view) {
      writable(session).view = clone(view);
      viewWrites++;
    },
    async copy(req) {
      checkFailure();
      const source = sessions.get(req.session);
      if (!source) throw new StorageError('missing');
      const original = store.files.get(source);
      return install(req.dest, {
        projectId: req.projectId,
        copiedFromProjectId: req.copiedFromProjectId ?? original?.copiedFromProjectId,
        doc: req.doc,
        rev: req.rev,
        view: req.view,
        formatVersion: req.doc.format_version,
        journal: [...(original?.journal ?? []), ...req.journal],
        readOnly: false,
      });
    },
    async backupFull(session) {
      checkFailure();
      const current = file(session);
      const path = `${current.projectId}/backup-${++store.sequence}.pcbk`;
      store.backups.set(path, {
        info: { file: path, kind: 'full', at: new Date().toISOString() },
        file: clone(current),
      });
    },
    async backups(projectId) {
      checkFailure();
      return [...store.backups.values()]
        .filter((item) => item.file.projectId === projectId)
        .map((item) => clone(item.info));
    },
    async restore(req) {
      checkFailure();
      const backup = store.backups.get(req.backup);
      if (!backup) throw new StorageError('missing');
      return install(req.dest, { ...clone(backup.file), readOnly: false });
    },
    async close(session) {
      const path = sessions.get(session);
      if (path && store.locks.get(path) === session) store.locks.delete(path);
      sessions.delete(session);
    },
  };
  return {
    ...repo,
    failNext(reason: StorageReason) {
      failure = reason;
    },
    setReadOnly(path: string, readOnly: boolean) {
      const current = store.files.get(path);
      if (!current) throw new StorageError('missing');
      current.readOnly = readOnly;
    },
    get documentWrites() {
      return documentWrites;
    },
    get viewWrites() {
      return viewWrites;
    },
  };
}
