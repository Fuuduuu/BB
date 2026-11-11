<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/primitives.ts`

### `CountSchema`
```ts
export const CountSchema: ZodType<number>;
```

### `EndRef`
```ts
export type EndRef = { pin: PinRef; } | { junction: string; };
```

### `EndRefSchema`
```ts
export const EndRefSchema: ZodType<EndRef>;
```

### `IdSchema`
```ts
export const IdSchema: ZodType<string>;
```

### `Layer`
```ts
export type Layer = "top" | "bottom";
```

### `LayerSchema`
```ts
export const LayerSchema: ZodType<Layer>;
```

### `MeasuredPin`
```ts
export type MeasuredPin = {
    c: string;
    p: string;
    uid: string;
};
```

### `MeasuredPinSchema`
```ts
export const MeasuredPinSchema: ZodType<MeasuredPin>;
```

### `PinRef`
```ts
export type PinRef = {
    c: string;
    p: string;
};
```

### `PinRefSchema`
```ts
export const PinRefSchema: ZodType<PinRef>;
```

### `Side`
```ts
export type Side = "top" | "bottom";
```

### `SideSchema`
```ts
export const SideSchema: ZodType<Side>;
```

### `TimestampSchema`
```ts
export const TimestampSchema: ZodType<string>;
```

### `Vec2`
```ts
export type Vec2 = {
    x: number;
    y: number;
};
```

### `Vec2Schema`
```ts
export const Vec2Schema: ZodType<Vec2>;
```
