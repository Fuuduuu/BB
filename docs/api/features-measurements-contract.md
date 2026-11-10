<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-measurements-contract

Sisenemispunkt: `packages/features/measurements/contract.ts`

### `AddMeasurementParams`
```ts
export type AddMeasurementParams = {
    id: string;
    power: "unknown" | "on" | "off";
    at: { c: string; p: string; uid: string; };
    takenAt: string;
    mode: "voltage";
    value: number;
    note?: string | undefined;
    ref?: { c: string; p: string; uid: string; } | undefined;
};
```

### `AddMeasurementSchema`
```ts
export const AddMeasurementSchema: ZodType<AddMeasurementParams>;
```

### `RemoveMeasurementParams`
```ts
export type RemoveMeasurementParams = {
    id: string;
};
```

### `RemoveMeasurementSchema`
```ts
export const RemoveMeasurementSchema: ZodType<RemoveMeasurementParams>;
```
