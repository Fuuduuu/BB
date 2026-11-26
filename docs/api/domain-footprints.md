<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/footprints

Sisenemispunkt: `packages/domain/src/footprints/index.ts`

### `BodyFlat`
```ts
export type BodyFlat = '-x' | '+x' | '-y' | '+y';
```

### `bodyLocalMarks`
```ts
export function bodyLocalMarks(geometry: FootprintGeom, shape: BodyShapeSpec, specs: readonly BodyMarkSpec[]): BodyMark[];
```

### `bodyLocalOutline`

Jagatud kontuur millimeetrites.

```ts
export function bodyLocalOutline({ w, h }: FootprintGeom['body'], spec: BodyShapeSpec): Vec2[];
```

### `BodyMark`
```ts
export interface BodyMark {
    kind: BodyMarkKind;
    lines: Vec2[][];
    filled: boolean;
}
```

### `BodyMarkKind`
```ts
export type BodyMarkKind = 'plus' | 'band' | 'notch' | 'tab';
```

### `BodyMarkSpec`
```ts
export type BodyMarkSpec = {
    kind: 'plus';
    pin: string;
} | {
    kind: 'band';
    pin: string;
} | {
    kind: 'notch';
    at: 'edge' | 'corner';
} | {
    kind: 'tab';
};
```

### `BodyShape`
```ts
export type BodyShape = 'rect' | 'circle' | 'oval' | 'd';
```

### `BodyShapeSpec`
```ts
export interface BodyShapeSpec {
    shape: BodyShape;
    flat?: BodyFlat;
}
```

### `footprintBodyMarks`
```ts
export function footprintBodyMarks(key: string): readonly BodyMarkSpec[];
```

### `footprintBodyShape`
```ts
export function footprintBodyShape(key: string): BodyShapeSpec;
```

### `FootprintDef`
```ts
export interface FootprintDef {
    key: string;
    name: string;
    defaults: FootprintParams;
    bodyShape?: BodyShapeSpec;
    bodyMarks?: readonly BodyMarkSpec[];
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
    shape: 'rect' | 'circle' | 'oval';
    through: boolean;
    name?: string;
}
```
