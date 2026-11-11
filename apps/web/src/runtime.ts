import { createEngine, createProjectService } from '@pcbk/engine';
import { newId } from '@pcbk/domain';
import { createWebRepository } from '@pcbk/adapters';
import { engineFeatures, RESERVED_FIELDS } from '@pcbk/features/engine';
export function createRuntime() {
  const clock = { now: () => new Date().toISOString() };
  const ids = { newId };
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock,
    onInternalError: (error, commandId) => console.error('[engine] internal', commandId, error),
  });
  const repo = createWebRepository();
  const projects = createProjectService({ engine, host, repo, clock, ids });
  return { engine, projects, repo, ids };
}
export type Runtime = ReturnType<typeof createRuntime>;
