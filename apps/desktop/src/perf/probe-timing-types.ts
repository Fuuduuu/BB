export type CommandPhase = 'validateDocument' | 'derived' | 'nets';

declare global {
  var __PCBK_PERF_RECORD_PHASE__: ((phase: CommandPhase, duration: number) => void) | undefined;
}
