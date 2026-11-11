import { invoke } from '@tauri-apps/api/core';
import { warn as logWarning } from '@tauri-apps/plugin-log';
import { createTauriRepository } from '@pcbk/adapters';
import { newId } from '@pcbk/domain';
import { createEngine, createProjectService } from '@pcbk/engine';
import { engineFeatures, RESERVED_FIELDS } from '@pcbk/features/engine';
import { createDesktopHost } from './desktop-host';

export function createRuntime() {
  const clock = { now: () => new Date().toISOString() };
  const ids = { newId };
  const warn = (message: string) => {
    void logWarning(message).catch(() => console.warn(message));
  };
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock,
    onInternalError: (error, commandId) => console.error('[engine] internal', commandId, error),
  });
  const repo = createTauriRepository({ invoke, warn });
  const projects = createProjectService({ engine, host, repo, clock, ids });
  return { engine, projects, ids, appHost: createDesktopHost(warn) };
}
