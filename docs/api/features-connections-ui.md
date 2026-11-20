<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-connections-ui

Sisenemispunkt: `packages/features/connections/ui/index.tsx`

### `connectionPoints`
```ts
export function connectionPoints(doc: Doc, { a, b, board }: Pick<Connection, 'a' | 'b' | 'board'>): Vec2[] | undefined;
```

### `createConnectionsUi`
```ts
export function createConnectionsUi(ids: IdGen, { roleColor, netName }: {
    roleColor: ConnectionRoleColor;
    netName: ConnectionNetName;
}): UiModule;
```
