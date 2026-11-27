<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/schematic

Sisenemispunkt: `packages/domain/src/schematic/index.ts`

### `MONO_ADVANCE_EM`

Calibrated against the application's Martian Mono font in Chromium.

```ts
export const MONO_ADVANCE_EM: 0.72;
```

### `SCHEMATIC_GRID_MM`
```ts
export const SCHEMATIC_GRID_MM: 2.54;
```

### `schematicSymbol`
```ts
export function schematicSymbol(component: Readonly<Pick<Component, 'kind'>> & {
    readonly pins: readonly Readonly<Pin>[];
    readonly schematic?: Readonly<Pick<SymbolPlacement, 'pinMap'>>;
}): SchematicSymbol | null;
```

### `SchematicSymbol`
```ts
export type SchematicSymbol = Readonly<{
    id: SymbolId;
    prims: readonly SymbolPrim[];
    pins: readonly SymbolPin[];
    bounds: Readonly<{
        min: Readonly<Vec2>;
        max: Readonly<Vec2>;
    }>;
    label: Readonly<Vec2>;
}>;
```

### `SymbolId`
```ts
export type SymbolId = 'resistor' | 'capacitor' | 'capacitor_polarized' | 'inductor' | 'diode' | 'led' | 'zener' | 'npn' | 'pnp' | 'nmos' | 'pmos' | 'crystal' | 'switch' | 'fuse' | 'terminal' | 'box';
```

### `SymbolPin`
```ts
export type SymbolPin = Readonly<{
    contact: string;
    pinId: string;
    end: Readonly<Vec2>;
    inner: Readonly<Vec2>;
}>;
```

### `SymbolPrim`
```ts
export type SymbolPrim = Readonly<{
    kind: 'line';
    points: readonly Readonly<Vec2>[];
    closed?: boolean;
    fill?: boolean;
}> | Readonly<{
    kind: 'circle';
    at: Readonly<Vec2>;
    r: number;
    fill?: boolean;
}> | Readonly<{
    kind: 'text';
    at: Readonly<Vec2>;
    text: string;
    size: number;
    anchor: 'start' | 'middle' | 'end';
}>;
```

### `symbolToSchematic`
```ts
export function symbolToSchematic({ at, rot, mirror }: Pick<SymbolPlacement, 'at' | 'rot' | 'mirror'>, local: Readonly<Vec2>): Vec2;
```
