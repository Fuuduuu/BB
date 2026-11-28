import type { Snapshot } from '@pcbk/contracts';

export type CommandPhase = 'validateDocument' | 'derived' | keyof Snapshot['derived'];

declare global {
  var __PCBK_PERF_RECORD_PHASE__: ((phase: CommandPhase, duration: number) => void) | undefined;
}
