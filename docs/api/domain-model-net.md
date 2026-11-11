<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/net.ts`

### `NetLabel`
```ts
export type NetLabel = {
    id: string;
    anchor: { pin: { c: string; p: string; }; } | { junction: string; };
    source: "user" | "import";
    name?: string | undefined;
    roleId?: string | undefined;
};
```

### `NetLabelSchema`
```ts
export const NetLabelSchema: ZodType<NetLabel>;
```

### `NetRole`
```ts
export type NetRole = {
    id: string;
    label: string;
    kind: "unknown" | "ground" | "power" | "signal";
    color: string;
    nominalV?: number | undefined;
};
```

### `NetRoleSchema`
```ts
export const NetRoleSchema: ZodType<NetRole>;
```
