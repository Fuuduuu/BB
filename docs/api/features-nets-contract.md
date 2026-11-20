<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-nets-contract

Sisenemispunkt: `packages/features/nets/contract.ts`

### `AddRoleParams`
```ts
export type AddRoleParams = {
    role: { id: string; label: string; kind: "unknown" | "ground" | "power" | "signal"; color: string; nominalV?: number | undefined; };
};
```

### `AddRoleSchema`
```ts
export const AddRoleSchema: ZodType<AddRoleParams>;
```

### `AssignNetParams`
```ts
export type AssignNetParams = {
    anchor: { pin: { c: string; p: string; }; } | { junction: string; };
    labelId: string;
    name?: string | undefined;
    roleId?: string | null | undefined;
};
```

### `AssignNetSchema`
```ts
export const AssignNetSchema: ZodType<AssignNetParams>;
```

### `JoinNetsParams`
```ts
export type JoinNetsParams = {
    connectionId: string;
    a: { pin: { c: string; p: string; }; } | { junction: string; };
    b: { pin: { c: string; p: string; }; } | { junction: string; };
};
```

### `JoinNetsSchema`
```ts
export const JoinNetsSchema: ZodType<JoinNetsParams>;
```

### `NetsDerivedSchema`
```ts
export const NetsDerivedSchema: ZodType<{ list: { key: string; members: string[]; name: string; named: boolean; roleConflict: boolean; conflictingRoles: string[]; beepContradiction: boolean; roleId?: string | undefined; }[]; netOf: Record<string, string>; shortedComponents: string[]; }>;
```

### `RemoveRoleParams`
```ts
export type RemoveRoleParams = {
    id: string;
};
```

### `RemoveRoleSchema`
```ts
export const RemoveRoleSchema: ZodType<RemoveRoleParams>;
```

### `UpdateRoleParams`
```ts
export type UpdateRoleParams = {
    id: string;
    label?: string | undefined;
    kind?: "unknown" | "ground" | "power" | "signal" | undefined;
    nominalV?: number | null | undefined;
    color?: string | undefined;
};
```

### `UpdateRoleSchema`
```ts
export const UpdateRoleSchema: ZodType<UpdateRoleParams>;
```
