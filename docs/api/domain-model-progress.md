<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/progress.ts`

### `ProgressSnapshot`
```ts
export type ProgressSnapshot = {
    componentsIdentified: [
        number,
        number
    ];
    pinsMapped: [
        number,
        number
    ];
    unplaced: { board: number; schematic: number; };
    powerDefined: boolean;
    assumedConnections: number;
    roleConflicts: number;
    openImportChecks: number;
    suspectMeasurements: number;
};
```

### `ProgressSnapshotSchema`
```ts
export const ProgressSnapshotSchema: ZodType<ProgressSnapshot>;
```
