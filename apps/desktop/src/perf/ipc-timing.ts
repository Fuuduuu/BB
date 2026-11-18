import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { createTauriRepository, type TauriInvoke } from '@pcbk/adapters';
import { BoardDocSchema } from '@pcbk/domain';

type Sample = { command: 'project_open' | 'project_save'; elapsedMs: number };

export async function measureProjectIpc(
  path: string,
  invoke: TauriInvoke = tauriInvoke,
  now = () => performance.now(),
): Promise<Sample[]> {
  const samples: Sample[] = [];
  const repository = createTauriRepository({
    async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
      if (command !== 'project_open' && command !== 'project_save') return invoke<T>(command, args);
      const started = now();
      const result = await invoke<T>(command, args);
      samples.push({ command, elapsedMs: now() - started });
      return result;
    },
  });
  const opened = await repository.open(path);
  try {
    const doc = BoardDocSchema.parse(opened.doc);
    // Write the full probe document at its current revision, without a synthetic edit or journal entry.
    await repository.save({
      session: opened.session,
      baseRev: doc.rev,
      rev: doc.rev,
      doc,
      journal: [],
    });
  } finally {
    await repository.close(opened.session);
  }
  return samples;
}
