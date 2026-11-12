import { createEngine, createProjectService } from '@pcbk/engine';
import { newId } from '@pcbk/domain';
import { createWebPhotoStore, createWebRepository } from '@pcbk/adapters';
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
  const photoStore = createWebPhotoStore();
  const photos = photoStore.photos;
  const repo = createWebRepository({ photoLifecycle: photoStore });
  const projects = createProjectService({ engine, host, repo, photos, clock, ids });
  return { engine, projects, repo, photos, ids };
}
export type Runtime = ReturnType<typeof createRuntime>;
