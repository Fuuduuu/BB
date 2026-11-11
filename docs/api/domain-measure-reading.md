<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/measure/reading

Sisenemispunkt: `packages/domain/src/measure/reading.ts`

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

### `ReadingMode`
```ts
export type ReadingMode = 'voltage';
```
