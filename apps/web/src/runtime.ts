import { createEngine, createProjectService } from '@pcbk/engine';
import { newId } from '@pcbk/domain';
import { createWebRepository } from '@pcbk/adapters';
import { engineFeatures, reservedFields } from './engine.features';
export function createRuntime() {
  const clock = { now: () => new Date().toISOString() };
  const ids = { newId };
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: reservedFields,
    clock,
  });
  const repo = createWebRepository();
  const projects = createProjectService({ engine, host, repo, clock, ids });
  return { engine, projects, repo, ids };
}
export type Runtime = ReturnType<typeof createRuntime>;
