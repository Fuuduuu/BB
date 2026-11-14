<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/ui

Sisenemispunkt: `packages/ui/src/canvas/index.ts`

### `Canvas`
```ts
export function Canvas({ layers, tools, keys, sceneTransform, view, onViewChange, snapshot, execute, surface, fitInsets, }: CanvasProps): import("react").JSX.Element;
```

### `CanvasPointer`
```ts
export interface CanvasPointer {
    world: Vec2;
    screen: Vec2;
    hit?: HitItem;
    shift: boolean;
    alt: boolean;
    ctrl: boolean;
}
```

### `CanvasProps`
```ts
export interface CanvasProps {
    layers: readonly LayerSpec[];
    tools: readonly ToolSpec[];
    keys?: readonly KeySpec[];
    sceneTransform: SceneTransform;
    view: CanvasView;
    onViewChange(view: CanvasView): void;
    snapshot: Snapshot;
    execute: DocumentEngine['execute'];
    surface?: {
        width: number;
        height: number;
    };
    fitInsets?: {
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
    };
}
```

### `CanvasTool`
```ts
export interface CanvasTool {
    id: string;
    cursor: string;
    onPointerDown(event: CanvasPointer, api: ToolApi): void;
    onPointerMove(event: CanvasPointer, api: ToolApi): void;
    onPointerUp(event: CanvasPointer, api: ToolApi): void;
    onKey?(event: KeyboardEvent, api: ToolApi): boolean;
    overlay?(api: ToolApi): JSX.Element | null;
    onCancel?(api: ToolApi): void;
}
```

### `createHitIndex`
```ts
export function createHitIndex(items: HitItem[], cellPx?: number): HitIndex;
```

### `HitDrag`
```ts
export type HitDrag = {
    owner: string;
    commit(delta: Vec2, api: ToolApi): void;
};
```

### `HitIndex`
```ts
export interface HitIndex {
    query(world: Vec2, zoom: number): HitItem | undefined;
}
```

### `HitItem`
```ts
export interface HitItem {
    kind: string;
    id: string;
    componentId?: string;
    shape: HitShape;
    priority?: number;
    data?: unknown;
    target?: SelectionItem;
    drag?: HitDrag;
}
```

### `HitShape`
```ts
export type HitShape = {
    type: 'point';
    at: Vec2;
    r: number;
} | {
    type: 'segment';
    a: Vec2;
    b: Vec2;
    width: number;
} | {
    type: 'area';
    polygon: Vec2[];
};
```

### `LayerSpec`
```ts
export type LayerSpec = {
    id: string;
    z: number;
    render(props: {
        snapshot: Snapshot;
        preview: Preview | null;
        zoom: number;
    }): ReactNode;
    hits?(snapshot: Snapshot, zoom: number, sceneTransform: SceneTransform): HitItem[];
};
```

### `SceneText`
```ts
export function SceneText({ x, y, sceneTransform, transform, ...props }: SceneTextProps): import("react").JSX.Element;
```

### `sceneToScreenVector`
```ts
export function sceneToScreenVector(transform: SceneTransform, { x, y }: Vec2): Vec2;
```

### `SceneTransform`
```ts
export type SceneTransform = PhotoRef['transform'];
```

### `screenToSceneVector`
```ts
export function screenToSceneVector(transform: SceneTransform, { x, y }: Vec2): Vec2;
```

### `ToolApi`
```ts
export interface ToolApi {
    execute: DocumentEngine['execute'];
    select(selection: Selection): void;
    setPreview(preview: Preview | null): void;
    hitIndex: HitIndex;
    snapshot(): Snapshot;
    sceneTransform(): SceneTransform;
}
```

### `ToolSpec`
```ts
export interface ToolSpec {
    id: string;
    label: string;
    icon: string;
    key?: string;
    group: 'select' | 'draw' | 'measure' | 'mechanical';
    create(): CanvasTool;
}
```

### `TranslatePreviewData`
```ts
export type TranslatePreviewData = {
    items: SelectionItem[];
    dx: number;
    dy: number;
};
```

### `useSceneTransform`
```ts
export function useSceneTransform(): SceneTransform;
```
