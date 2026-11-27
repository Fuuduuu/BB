<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-schematic-contract

Sisenemispunkt: `packages/features/schematic/contract.ts`

### `SchematicPlaceParams`
```ts
export type SchematicPlaceParams = {
    items: { at: { x: number; y: number; }; rot: 0 | 90 | 180 | 270; mirror: boolean; id: string; }[];
};
```

### `SchematicPlaceSchema`
```ts
export const SchematicPlaceSchema: ZodType<SchematicPlaceParams>;
```

### `SchematicRemoveParams`
```ts
export type SchematicRemoveParams = {
    ids: string[];
};
```

### `SchematicRemoveSchema`
```ts
export const SchematicRemoveSchema: ZodType<SchematicRemoveParams>;
```
