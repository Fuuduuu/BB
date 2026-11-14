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
  const importBytes = vi.fn(
    async (_session: string, _bytes: ArrayBuffer, id: string, name: string) => ({
      id,
      side: 'top' as const,
      name,
      widthPx: 300,
      heightPx: 200,
      transform: 'none' as const,
    }),
  );
  const projects = createProjectService({
    engine,
    host,
    repo: createMemoryRepository(createMemoryStore()),
    photos: { prune: async () => undefined, url, importBytes },
    clock: { now: () => '2026-11-12T12:00:00.000Z' },
    ids: idGenerator(),
    timing: { debounceMs: 60_000, maxWaitMs: 120_000 },
  });
  return { engine, host, projects, url, importBytes };
}
