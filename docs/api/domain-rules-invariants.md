<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/rules

Sisenemispunkt: `packages/domain/src/rules/invariants.ts`

### `Invariant`
```ts
export interface Invariant {
    id: string;
    inputs: readonly DocKey[];
    check(doc: BoardDoc): Issue[];
}
```

### `INVARIANTS`
```ts
export const INVARIANTS: readonly Invariant[];
```

### `Issue`
```ts
export interface Issue {
    path: (string | number)[];
    code: string;
}
```
