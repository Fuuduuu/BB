<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/measure

Sisenemispunkt: `packages/domain/src/measure/index.ts`

### `formatReading`
```ts
export function formatReading(reading: {
    value: number;
}, mode: ReadingMode): string;
```

### `parseReading`
```ts
export function parseReading(text: string, mode: ReadingMode): {
    value: number;
} | null;
```

### `PinReading`
```ts
export interface PinReading {
    measurementId: string;
    mode: 'voltage';
    value: number;
    takenAt: string;
}
```

### `pinReadings`
```ts
export function pinReadings(doc: PinReadingSource): Record<string, PinReading>;
```

### `PinReadingSource`
```ts
export interface PinReadingSource {
    readonly components: readonly {
        readonly id: string;
        readonly pins: readonly Readonly<Pick<Pin, 'id' | 'uid'>>[];
    }[];
    readonly measurements: readonly Readonly<Measurement>[];
}
```

### `PinReadingsSchema`
```ts
export const PinReadingsSchema: ZodType<{ [x: string]: { measurementId: string; mode: "voltage"; value: number; takenAt: string; }; }>;
```

### `ReadingMode`
```ts
export type ReadingMode = 'voltage';
```
