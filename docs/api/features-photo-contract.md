<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-photo-contract

Sisenemispunkt: `packages/features/photo/contract.ts`

### `AddPhotoParams`
```ts
export type AddPhotoParams = {
    photo: { id: string; side: "top" | "bottom"; name: string; widthPx: number; heightPx: number; transform: "mirror" | "none" | "rot90" | "rot180" | "rot270" | "mirror_rot90" | "mirror_rot180" | "mirror_rot270"; toBoard?: [
        number,
        number,
        number,
        number,
        number,
        number
    ] | undefined; };
};
```

### `AddPhotoSchema`
```ts
export const AddPhotoSchema: ZodType<AddPhotoParams>;
```

### `SetPhotoScaleParams`
```ts
export type SetPhotoScaleParams = {
    a: { x: number; y: number; };
    b: { x: number; y: number; };
    mm: number;
};
```

### `SetPhotoScaleSchema`
```ts
export const SetPhotoScaleSchema: ZodType<SetPhotoScaleParams>;
```

### `SetPhotoTransformParams`
```ts
export type SetPhotoTransformParams = {
    id: string;
    transform: "mirror" | "none" | "rot90" | "rot180" | "rot270" | "mirror_rot90" | "mirror_rot180" | "mirror_rot270";
};
```

### `SetPhotoTransformSchema`
```ts
export const SetPhotoTransformSchema: ZodType<SetPhotoTransformParams>;
```
