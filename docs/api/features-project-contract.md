<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-project-contract

Sisenemispunkt: `packages/features/project/contract.ts`

### `RenameProjectParams`
```ts
export type RenameProjectParams = {
    name: string;
};
```

### `RenameProjectSchema`
```ts
export const RenameProjectSchema: ZodType<RenameProjectParams>;
```

### `SetProjectInfoParams`
```ts
export type SetProjectInfoParams = {
    device?: string | undefined;
    problem?: string | undefined;
};
```

### `SetProjectInfoSchema`
```ts
export const SetProjectInfoSchema: ZodType<SetProjectInfoParams>;
```
