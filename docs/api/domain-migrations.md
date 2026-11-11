<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/migrations

Sisenemispunkt: `packages/domain/src/migrations/index.ts`

### `migrateDoc`
```ts
export function migrateDoc(raw: unknown, from: number, migrations?: Migration[]): unknown;
```

### `Migration`
```ts
export type Migration = {
    from: number;
    up(doc: unknown): unknown;
};
```

### `MIGRATIONS`
```ts
export const MIGRATIONS: Migration[];
```
