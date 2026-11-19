<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/rules

Sisenemispunkt: `packages/domain/src/rules/index.ts`

### `deleteItems`
```ts
export function deleteItems(doc: BoardDoc, ids: readonly string[]): RuleReport;
```

### `endKey`
```ts
export const endKey: (end: EndRef) => string;
```

### `endRefsByKey`
```ts
export function endRefsByKey(doc: BoardDoc): ReadonlyMap<string, EndRef>;
```

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

### `ITEM_FIELDS`
```ts
export const ITEM_FIELDS: readonly [
    "components",
    "connections",
    "junctions",
    "netLabels"
];
```

### `ItemRef`
```ts
export type ItemRef = {
    kind: "component";
    id: string;
};
```

### `ItemRefSchema`
```ts
export const ItemRefSchema: ZodType<ItemRef>;
```

### `NetMembership`
```ts
export interface NetMembership {
    netOf: ReadonlyMap<string, string>;
    members: ReadonlyMap<string, readonly string[]>;
}
```

### `pinKey`
```ts
export const pinKey: (ref: PinRef) => string;
```

### `removeBoardDrawing`
```ts
export function removeBoardDrawing(doc: BoardDoc, ids: readonly string[]): void;
```

### `removeConnections`
```ts
export function removeConnections(doc: BoardDoc, ids: readonly string[]): RuleReport;
```

### `removeJunctions`
```ts
export function removeJunctions(doc: BoardDoc, ids: readonly string[]): RuleReport;
```

### `removePins`
```ts
export function removePins(doc: BoardDoc, componentId: string, pinIds: readonly string[]): RuleReport;
```

### `resolveNets`
```ts
export function resolveNets(doc: BoardDoc): NetMembership;
```

### `RuleRejected`
```ts
export class RuleRejected extends Error {
    readonly reason: string;
    name: string;
    constructor(reason: string);
}
```

### `RuleReport`
```ts
export interface RuleReport {
    removedLabels: NetLabel[];
}
```

### `RuleTargetNotFound`
```ts
export class RuleTargetNotFound extends Error {
    readonly id: string;
    name: string;
    constructor(id: string);
}
```

### `translateItems`
```ts
export function translateItems(doc: BoardDoc, items: readonly ItemRef[], delta: Vec2): void;
```
