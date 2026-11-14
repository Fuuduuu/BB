import type { BoardDoc } from '@pcbk/domain';
import type { SaveStatus } from '@pcbk/contracts';
import type { PhotoStore, ProjectRepository, SaveReq } from '../ports';
import * as api from '../index';
import * as storage from '../../../adapters/src/storage-memory';
import { expect } from 'vitest';
import { clock, demo, withTestOwners } from './helpers';

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
export function blockFirstSave(repo: ProjectRepository) {
  const started = deferred();
  const release = deferred();
  const requests: SaveReq[] = [];
  let running = 0;
  let maxRunning = 0;
  const wrapped: ProjectRepository = {
    ...repo,
    async save(req) {
      requests.push(req);
      running++;
      maxRunning = Math.max(maxRunning, running);
      try {
        if (requests.length === 1) {
          started.resolve();
          await release.promise;
        }
        await repo.save(req);
      } finally {
        running--;
      }
    },
    async saveView(session, view) {
      running++;
      maxRunning = Math.max(maxRunning, running);
      try {
        await repo.saveView(session, view);
      } finally {
        running--;
      }
    },
  };
  return {
    repo: wrapped,
    started: started.promise,
    release: release.resolve,
    requests,
    max: () => maxRunning,
  };
}
let fixture = 0;
export async function projectSetup(
  options: {
    create?: boolean;
    wrap?: (repo: ProjectRepository) => ProjectRepository;
    timing?: { debounceMs: number; maxWaitMs: number };
    photos?: Partial<Pick<PhotoStore, 'prune' | 'url' | 'importBytes'>>;
  } = {},
) {
  expect(api.createProjectService).toBeTypeOf('function');
  expect(storage.createMemoryStore).toBeTypeOf('function');
  const store = storage.createMemoryStore();
  const memory = storage.createMemoryRepository(store);
  const repo = options.wrap ? options.wrap(memory) : memory;
  const { engine, host } = api.createEngine({ modules: withTestOwners([demo]), clock });
  const instance = ++fixture;
  let id = 0;
  const projects = api.createProjectService({
    engine,
    host,
    repo,
    photos: {
      prune: options.photos?.prune ?? (async () => undefined),
      url: options.photos?.url ?? (() => ''),
      importBytes:
        options.photos?.importBytes ??
        (async (_session, _bytes, id, name) => ({
          id,
          name,
          side: 'top',
          widthPx: 1,
          heightPx: 1,
          transform: 'none',
        })),
    },
    clock,
    ids: { newId: (prefix) => `${prefix}_${instance}_${++id}` },
    timing: options.timing,
  });
  const statuses: (SaveStatus & { sessionId: string })[] = [];
  projects.status((status) => {
    statuses.push(status);
  });
  const path = 'Board õäöü (2).pcbk';
  if (options.create !== false)
    expect((await projects.create({ name: 'Board', path })).ok).toBe(true);
  return { engine, host, projects, repo, memory, store, path, statuses };
}
export function seed(
  store: storage.MemoryStore,
  path: string,
  doc: unknown,
  formatVersion = 1,
  readOnly = false,
) {
  store.files.set(path, {
    projectId: `project_${path}`,
    doc,
    formatVersion,
    readOnly,
    rev: (doc as BoardDoc).rev,
    view: null,
    journal: [],
  });
}
