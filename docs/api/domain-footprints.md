<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/footprints

Sisenemispunkt: `packages/domain/src/footprints/index.ts`

### `FootprintDef`
```ts
export interface FootprintDef {
    key: string;
    name: string;
    defaults: FootprintParams;
    gen(p: FootprintParams): FootprintGeom | undefined;
}
```

### `FootprintGeom`
```ts
export interface FootprintGeom {
    pads: PadGeom[];
    body: {
        w: number;
        h: number;
        pin1?: Vec2;
    };
}
```

### `footprintGeometry`
```ts
export function footprintGeometry(key: string, params: FootprintParams): FootprintGeom | undefined;
```

### `FootprintParams`
```ts
export interface FootprintParams {
    [key: string]: string | number;
}
```

### `footprintPinIds`
```ts
export function footprintPinIds(key: string, params: FootprintParams): string[] | undefined;
```

### `FOOTPRINTS`
```ts
export const FOOTPRINTS: readonly FootprintDef[];
```

### `PadGeom`
```ts
export interface PadGeom {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    shape: 'rect' | 'circle';
    through: boolean;
}
```
