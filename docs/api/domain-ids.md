<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/ids

Sisenemispunkt: `packages/domain/src/ids.ts`

### `IdPrefix`
```ts
export type IdPrefix = 'cmp' | 'jun' | 'con' | 'lbl' | 'rol' | 'msr' | 'rep' | 'pho' | 'dim' | 'are' | 'att' | 'txt' | 'chk' | 'pin';
```

### `newId`
```ts
export function newId(prefix: IdPrefix): string;
```
