<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-connections-contract

Sisenemispunkt: `packages/features/connections/contract.ts`

### `AddConnectionsParams`
```ts
export type AddConnectionsParams = {
    items: { id: string; a: { pin: { c: string; p: string; }; } | { junction: string; }; b: { pin: { c: string; p: string; }; } | { junction: string; }; }[];
    basis: "assumed" | "visual";
    skipJoined: boolean;
};
```

### `AddConnectionsSchema`
```ts
export const AddConnectionsSchema: ZodType<AddConnectionsParams>;
```

### `ConnectionIdsParams`
```ts
export type ConnectionIdsParams = {
    ids: string[];
};
```

### `ConnectionIdsSchema`
```ts
export const ConnectionIdsSchema: ZodType<ConnectionIdsParams>;
```
