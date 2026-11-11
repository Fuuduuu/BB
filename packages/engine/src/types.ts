import type { BoardDoc, DocKey } from '@pcbk/domain';
import type { DeepReadonly, Derived, DomainEvent } from '@pcbk/contracts';
import type { Draft } from 'immer';
import type { z } from 'zod';

export interface Clock {
  now(): string;
}
export type PendingEvent = Pick<DomainEvent, 'type' | 'payload'>;
export interface CommandCtx {
  readonly derived: DeepReadonly<Derived>;
  emit(event: PendingEvent): void;
}
export interface CommandSpec<P> {
  id: `${string}.${string}`;
  title: string;
  params: z.ZodType<P>;
  run(draft: Draft<BoardDoc>, params: P, ctx: CommandCtx): void;
  alsoWrites?: DocKey[];
  summary?(params: P, doc: BoardDoc): string;
}
export type DeriveSpec<K extends keyof Derived = keyof Derived> = {
  [Key in K]: {
    key: Key;
    inputs: DocKey[];
    schema: z.ZodType<Derived[Key]>;
    initial: Derived[Key];
    run(doc: DeepReadonly<BoardDoc>, derived: DeepReadonly<Derived>): Derived[Key];
  };
}[K];
export interface EngineModule {
  id: string;
  dependsOn?: string[];
  owns?: DocKey[];
  // Heterogeneous schemas erase P at registration; parsing restores the schema/run pairing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commands?: CommandSpec<any>[];
  derive?: DeriveSpec[];
}
export type JournalEntry = {
  at: string;
  kind: 'command' | 'undo' | 'redo';
  commandId: string;
  requestId?: string;
  source: 'user';
  summary: string;
};
export interface EngineHost {
  load(sessionId: string, doc: BoardDoc, readOnly: boolean): void;
  unload(): void;
  current(): { sessionId: string; rev: number; doc: BoardDoc } | null;
  drainJournal(): JournalEntry[];
  // Return the original drained entries; a different session's entries are ignored.
  requeueJournal(entries: JournalEntry[]): void;
}
