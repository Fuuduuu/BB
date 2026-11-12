import { vi } from 'vitest';
import { createProjectService } from '@pcbk/engine';
import { createMemoryRepository, createMemoryStore } from '../../../adapters/src/storage-memory';
import { setup, idGenerator } from '../../__tests__/helpers';

export function photoUiFixture() {
  const { engine, host } = setup();
  const url = vi.fn(
    (session: string, id: string, variant: string) =>
      `http://example.test/${session}/${id}?v=${variant}`,
  );
  const projects = createProjectService({
    engine,
    host,
    repo: createMemoryRepository(createMemoryStore()),
    photos: { prune: async () => undefined, url },
    clock: { now: () => '2026-11-12T12:00:00.000Z' },
    ids: idGenerator(),
    timing: { debounceMs: 60_000, maxWaitMs: 120_000 },
  });
  return { engine, projects, url };
}
