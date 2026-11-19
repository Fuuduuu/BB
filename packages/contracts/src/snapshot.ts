import type { BoardDoc } from '@pcbk/domain';

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends ReadonlyMap<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends ReadonlySet<infer U>
      ? ReadonlySet<DeepReadonly<U>>
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

/** Feature contracts extend this interface with their registered derivation keys. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Derived {}

export interface Snapshot {
  readonly sessionId: string;
  readonly rev: number;
  readonly doc: DeepReadonly<BoardDoc>;
  readonly derived: DeepReadonly<Derived>;
  readonly history: DeepReadonly<{ canUndo: boolean; canRedo: boolean }>;
}
