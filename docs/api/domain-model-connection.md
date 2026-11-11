<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/connection.ts`

### `Connection`
```ts
export type Connection = {
    id: string;
    a: { pin: { c: string; p: string; }; } | { junction: string; };
    b: { pin: { c: string; p: string; }; } | { junction: string; };
    basis: "assumed" | "visual";
    board?: { kind: "trace" | "wire"; layer: "top" | "bottom"; waypoints: { x: number; y: number; }[]; widthMm: number; labelOffset?: { x: number; y: number; } | undefined; } | undefined;
    schematic?: { waypoints: { x: number; y: number; }[]; } | undefined;
};
```

### `ConnectionSchema`
```ts
export const ConnectionSchema: ZodType<Connection>;
```

### `Junction`
```ts
export type Junction = {
    id: string;
    board?: { at: { x: number; y: number; }; layer: "top" | "bottom"; } | undefined;
    schematic?: { at: { x: number; y: number; }; } | undefined;
};
```

### `JunctionSchema`
```ts
export const JunctionSchema: ZodType<Junction>;
```
