<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/geometry

Sisenemispunkt: `packages/domain/src/geometry/board.ts`

### `boardPads`
```ts
export function boardPads(placement: BoardPlacement, pinIds: readonly string[], pxPerMm: number): {
    pinId: string;
    at: Vec2;
    radiusPx: number;
}[];
```

### `bodyOutline`
```ts
export function bodyOutline(placement: BoardPlacement, pxPerMm: number): Vec2[];
```

### `padToBoard`
```ts
export function padToBoard(p: Pick<BoardPlacement, 'center' | 'rotationDeg' | 'side' | 'scaleX' | 'scaleY'>, local: Vec2, pxPerMm: number): Vec2;
```
