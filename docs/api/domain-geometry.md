<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/geometry

Sisenemispunkt: `packages/domain/src/geometry/board.ts`

### `boardPads`
```ts
export function boardPads(placement: BoardPlacement, pinIds: readonly string[], pxPerMm: number): {
    pinId: string;
    at: Vec2;
    radiusPx: number;
    halfPx: Vec2;
    angleDeg: number;
    shape: PadGeom['shape'];
    through: boolean;
}[];
```

### `boardSurface`
```ts
export function boardSurface(doc: SurfaceSource): {
    width: number;
    height: number;
};
```

### `boardToPad`
```ts
export function boardToPad(p: Pick<BoardPlacement, 'center' | 'rotationDeg' | 'side' | 'scaleX' | 'scaleY'>, point: Vec2, pxPerMm: number): Vec2;
```

### `bodyMarks`
```ts
export function bodyMarks(placement: BoardPlacement, pxPerMm: number): BodyMark[];
```

### `bodyOutline`
```ts
export function bodyOutline(placement: BoardPlacement, pxPerMm: number): Vec2[];
```

### `drawingSegmentPoints`
```ts
export function drawingSegmentPoints(a: Vec2, b: Vec2, kind: DrawingKind, zoom: number): Vec2[];
```

### `padToBoard`
```ts
export function padToBoard(p: Pick<BoardPlacement, 'center' | 'rotationDeg' | 'side' | 'scaleX' | 'scaleY'>, local: Vec2, pxPerMm: number): Vec2;
```

### `projectDrawingSegment`
```ts
export function projectDrawingSegment(at: Vec2, a: Vec2, b: Vec2, kind: DrawingKind): Vec2;
```

### `SceneSource`
```ts
export type SceneSource = Omit<SurfaceSource, 'photos'> & {
    readonly photos: readonly (SurfaceSource['photos'][number] & {
        readonly transform: PhotoRef['transform'];
    })[];
};
```

### `sceneTransformOf`
```ts
export function sceneTransformOf(doc: SceneSource): PhotoRef['transform'];
```

### `SurfaceSource`
```ts
export type SurfaceSource = {
    readonly photos: readonly {
        readonly id: string;
        readonly widthPx: number;
        readonly heightPx: number;
    }[];
    readonly activePhotoId?: string | undefined;
};
```

### `wirePath`
```ts
export function wirePath(points: readonly Vec2[]): string;
```
