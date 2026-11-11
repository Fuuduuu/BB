<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/photo.ts`

### `PhotoRef`
```ts
export type PhotoRef = {
    id: string;
    side: "top" | "bottom";
    name: string;
    widthPx: number;
    heightPx: number;
    transform: "mirror" | "none" | "rot90" | "rot180" | "rot270" | "mirror_rot90" | "mirror_rot180" | "mirror_rot270";
    toBoard?: [
        number,
        number,
        number,
        number,
        number,
        number
    ] | undefined;
};
```

### `PhotoRefSchema`
```ts
export const PhotoRefSchema: ZodType<PhotoRef>;
```
