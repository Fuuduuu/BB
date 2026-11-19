<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/rules

Sisenemispunkt: `packages/domain/src/rules/items.ts`

### `deleteItems`
```ts
export function deleteItems(doc: BoardDoc, ids: readonly string[]): void;
```

### `ITEM_FIELDS`
```ts
export const ITEM_FIELDS: readonly [
    "components"
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

### `removePins`
```ts
export function removePins(doc: BoardDoc, componentId: string, pinIds: readonly string[]): void;
```

### `translateItems`
```ts
export function translateItems(doc: BoardDoc, items: readonly ItemRef[], delta: Vec2): void;
```
