import type { BoardDoc } from '@pcbk/domain';

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export interface Derived {
  unplacedBoard: string[];
  unplacedSchematic: string[];
}

export interface Snapshot {
  readonly sessionId: string;
  readonly rev: number;
  readonly doc: DeepReadonly<BoardDoc>;
  readonly derived: DeepReadonly<Derived>;
  readonly history: DeepReadonly<{ canUndo: boolean; canRedo: boolean }>;
}
