<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/measurement.ts`

### `Measurement`
```ts
export type Measurement = {
    id: string;
    mode: "diode" | "voltage" | "resistance" | "continuity";
    at: { c: string; p: string; uid: string; };
    power: "unknown" | "on" | "off";
    takenAt: string;
    atLabel: string;
    source: "manual" | "beep_mode";
    ref?: { c: string; p: string; uid: string; } | undefined;
    value?: number | undefined;
    overload?: boolean | undefined;
    beep?: boolean | undefined;
    note?: string | undefined;
    refLabel?: string | undefined;
    staleByRepairId?: string | undefined;
};
```

### `MeasurementSchema`
```ts
export const MeasurementSchema: ZodType<Measurement>;
```
