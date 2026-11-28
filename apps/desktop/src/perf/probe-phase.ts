import type { CommandPhase } from './probe-timing-types';

export function measureProbePhase<T>(phase: CommandPhase, run: () => T): T {
  const record = globalThis.__PCBK_PERF_RECORD_PHASE__;
  if (!record) return run();
  const started = performance.now();
  try {
    return run();
  } finally {
    record(phase, performance.now() - started);
  }
}
