<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/component.ts`

### `BoardPlacement`
```ts
export type BoardPlacement = {
    footprint: string;
    params: Record<string, string | number>;
    center: { x: number; y: number; };
    rotationDeg: number;
    side: "top" | "bottom";
    scaleX: number;
    scaleY: number;
    customPads: Record<string, { local: { x: number; y: number; }; sizeMm: number; shape: "rect" | "circle"; through: boolean; }>;
    padMap?: Record<string, string> | undefined;
    labelOffset?: { x: number; y: number; } | undefined;
};
```

### `BoardPlacementSchema`
```ts
export const BoardPlacementSchema: ZodType<BoardPlacement>;
```

### `Component`
```ts
export type Component = {
    id: string;
    ref: string;
    kind: ComponentKind;
    marking: string;
    value: string;
    identified: boolean;
    dnp: boolean;
    note: string;
    pins: Pin[];
    referenceImageId?: string | undefined;
    board?: BoardPlacement | undefined;
    schematic?: SymbolPlacement | undefined;
};
```

### `ComponentKind`
```ts
export type ComponentKind = "resistor" | "capacitor" | "capacitor_polarized" | "inductor" | "diode" | "led" | "zener" | "npn" | "pnp" | "nmos" | "pmos" | "regulator" | "ic" | "connector" | "crystal" | "switch" | "fuse" | "testpoint" | "via" | "pad" | "wire_point" | "hole" | "other";
```

### `ComponentKindSchema`
```ts
export const ComponentKindSchema: ZodType<ComponentKind>;
```

### `ComponentSchema`
```ts
export const ComponentSchema: ZodType<Component>;
```

### `Pin`
```ts
export type Pin = {
    id: string;
    uid: string;
    nc: boolean;
    name?: string | undefined;
};
```

### `PinSchema`
```ts
export const PinSchema: ZodType<Pin>;
```

### `SymbolPlacement`
```ts
export type SymbolPlacement = {
    symbol: string;
    at: { x: number; y: number; };
    rot: 0 | 90 | 180 | 270;
    mirror: boolean;
    pinMap?: Record<string, string> | undefined;
    labelOffset?: { x: number; y: number; } | undefined;
};
```

### `SymbolPlacementSchema`
```ts
export const SymbolPlacementSchema: ZodType<SymbolPlacement>;
```
