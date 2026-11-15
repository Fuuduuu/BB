/** UI-only product modules; shell contributions are added after this check. */
export const UI_ONLY_MODULES = ['guide', 'export'] as const;

export function assertModulePairs(
  engineIds: readonly string[],
  uiIds: readonly string[],
  uiOnly: readonly string[],
): void {
  const engine = new Set(engineIds);
  const ui = new Set(uiIds);
  const exceptions = new Set(uiOnly);
  const missingEngine = uiIds.filter((id) => !engine.has(id) && !exceptions.has(id));
  const missingUi = engineIds.filter((id) => !ui.has(id));
  if (missingEngine.length || missingUi.length) {
    throw new Error(
      [
        ...missingEngine.map((id) => `Missing engine module for UI module: ${id}`),
        ...missingUi.map((id) => `Missing UI module for engine module: ${id}`),
      ].join('; '),
    );
  }
}
