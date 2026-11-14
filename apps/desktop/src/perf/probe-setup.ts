import { waitFor } from './probe-dom';

class ProbeStartError extends Error {
  constructor(
    readonly reason: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

export function environment() {
  return {
    window: { width: innerWidth, height: innerHeight, devicePixelRatio },
    hardwareConcurrency: navigator.hardwareConcurrency,
    visibilityState: document.visibilityState,
    hasFocus: document.hasFocus(),
  };
}

export async function awaitProbeReady(
  home: () => boolean,
  foregroundTimeout = 120_000,
  homeTimeout = 30_000,
) {
  try {
    await waitFor(
      () => document.visibilityState === 'visible' && document.hasFocus(),
      'foreground Tauri window',
      foregroundTimeout,
    );
  } catch (error) {
    throw new ProbeStartError('foreground_timeout', error);
  }
  try {
    await waitFor(home, 'initial home screen', homeTimeout);
  } catch (error) {
    throw new ProbeStartError('home_timeout', error);
  }
}

export function failureResult(error: unknown, reasons: string[] = [], projectPath?: string) {
  const invalidReasons = new Set(reasons);
  invalidReasons.add(error instanceof ProbeStartError ? error.reason : 'probe_failed');
  if (document.visibilityState !== 'visible') invalidReasons.add('window_hidden');
  if (!document.hasFocus()) invalidReasons.add('window_not_focused');
  return {
    valid: false,
    invalidReasons: [...invalidReasons],
    error: error instanceof Error ? error.message : String(error),
    projectPath,
    ...environment(),
  };
}

type Target = {
  kind: string;
  board?: { footprint: string; center: { x: number; y: number } } | null;
};
export function selectDenseTarget<T extends Target>(
  components: readonly T[],
  surface: { width: number; height: number },
) {
  const distance = (component: T) =>
    Math.hypot(
      component.board!.center.x - surface.width / 2,
      component.board!.center.y - surface.height / 2,
    );
  return components
    .filter((component) => component.kind === 'ic' && component.board?.footprint === 'soic')
    .sort((a, b) => distance(a) - distance(b))[0];
}
