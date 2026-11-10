import type { EngineError } from './errors';
import type { Result } from './result';
import type { Snapshot } from './snapshot';

// Feature contracts extend this interface through module augmentation.
export interface CommandMap {
  'items.delete': { ids: string[] };
  'items.translate': { items: { kind: 'component'; id: string }[]; dx: number; dy: number };
}

export type CommandId = Extract<keyof CommandMap, `${string}.${string}`>;
export type ParamsOf<C extends CommandId> = CommandMap[C];
export type CommandOk = { rev: number };
export type Unsubscribe = () => void;

export interface DomainEvent {
  readonly type: `${string}.${string}`;
  readonly sessionId: string;
  readonly rev: number;
  readonly payload: unknown;
}

export interface DocumentEngine {
  execute<C extends CommandId>(
    id: C,
    params: ParamsOf<C>,
    opts?: { requestId?: string },
  ): Result<CommandOk, EngineError>;
  undo(): Result<CommandOk, EngineError>;
  redo(): Result<CommandOk, EngineError>;
  snapshot(): Snapshot;
  subscribe(fn: (s: Snapshot) => void): Unsubscribe;
  events(fn: (e: DomainEvent) => void): Unsubscribe;
}
