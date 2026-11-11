<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/annotation.ts`

### `BoardOutline`
```ts
export type BoardOutline = {
    x: number;
    y: number;
    w: number;
    h: number;
    showDims: boolean;
};
```

### `BoardOutlineSchema`
```ts
export const BoardOutlineSchema: ZodType<BoardOutline>;
```

### `DamageArea`
```ts
export type DamageArea = {
    id: string;
    shape: "rect" | "ellipse";
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
};
```

### `DamageAreaSchema`
```ts
export const DamageAreaSchema: ZodType<DamageArea>;
```

### `DimEnd`
```ts
export type DimEnd = { pin: { c: string; p: string; }; } | { point: { x: number; y: number; }; };
```

### `DimEndSchema`
```ts
export const DimEndSchema: ZodType<DimEnd>;
```

### `Dimension`
```ts
export type Dimension = {
    id: string;
    a: DimEnd;
    b: DimEnd;
    offsetPx: number;
};
```

### `DimensionSchema`
```ts
export const DimensionSchema: ZodType<Dimension>;
```

### `ImportCheck`
```ts
export type ImportCheck = {
    id: string;
    at: { x: number; y: number; };
    layer: "top" | "bottom";
    junctions: string[];
    note: string;
};
```

### `ImportCheckSchema`
```ts
export const ImportCheckSchema: ZodType<ImportCheck>;
```

### `TextNote`
```ts
export type TextNote = {
    id: string;
    view: "board" | "schematic";
    at: { x: number; y: number; };
    text: string;
    anchor?: { component: string; } | { connection: string; } | { junction: string; } | undefined;
};
```

### `TextNoteSchema`
```ts
export const TextNoteSchema: ZodType<TextNote>;
```
