<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/repair.ts`

### `RepairAction`
```ts
export type RepairAction = {
    id: string;
    action: "other" | "replaced" | "removed" | "reflowed" | "trace_fixed" | "cleaned";
    text: string;
    at: string;
    affects: { component: string; } | { nets: ({ pin: { c: string; p: string; }; } | { junction: string; })[]; } | { wholeBoard: true; } | { nothing: true; };
};
```

### `RepairActionSchema`
```ts
export const RepairActionSchema: ZodType<RepairAction>;
```
