<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-components-contract

Sisenemispunkt: `packages/features/components/contract.ts`

### `AddComponentParams`
```ts
export type AddComponentParams = {
    id: string;
    kind: "resistor" | "capacitor" | "capacitor_polarized" | "inductor" | "diode" | "led" | "zener" | "npn" | "pnp" | "nmos" | "pmos" | "regulator" | "ic" | "connector" | "crystal" | "switch" | "fuse" | "testpoint" | "via" | "pad" | "wire_point" | "hole" | "other";
    pins: { uid: string; id: string; }[];
    ref?: string | undefined;
    marking?: string | undefined;
    value?: string | undefined;
    board?: BoardInput | undefined;
};
```

### `AddComponentSchema`
```ts
export const AddComponentSchema: ZodType<AddComponentParams>;
```

### `AddPinParams`
```ts
export type AddPinParams = {
    id: string;
    pin: { uid: string; id: string; };
};
```

### `AddPinSchema`
```ts
export const AddPinSchema: ZodType<AddPinParams>;
```

### `BoardInput`
```ts
export type BoardInput = {
    footprint: string;
    center: { x: number; y: number; };
    params?: Record<string, string | number> | undefined;
    rotationDeg?: number | undefined;
    side?: "top" | "bottom" | undefined;
};
```

### `BoardInputSchema`
```ts
export const BoardInputSchema: ZodType<BoardInput>;
```

### `COMPONENT_LIBRARY`
```ts
export const COMPONENT_LIBRARY: readonly LibraryEntry[];
```

### `ComponentTargetParams`
```ts
export type ComponentTargetParams = {
    id: string;
};
```

### `ComponentTargetSchema`
```ts
export const ComponentTargetSchema: ZodType<ComponentTargetParams>;
```

### `LibraryEntry`
```ts
export interface LibraryEntry {
    id: string;
    kind: ComponentKind;
    footprint: string;
    params: FootprintParams;
    kw: string;
}
```

### `makeAddComponent`
```ts
export function makeAddComponent(ids: IdGen, kind: ComponentKind, pinCount?: number): AddComponentParams;
```

### `makePlacedComponent`
```ts
export function makePlacedComponent(ids: IdGen, entry: LibraryEntry, params: FootprintParams, center: Vec2): AddComponentParams;
```

### `PinTargetParams`
```ts
export type PinTargetParams = {
    id: string;
    pinId: string;
};
```

### `PinTargetSchema`
```ts
export const PinTargetSchema: ZodType<PinTargetParams>;
```

### `PlaceOnBoardParams`
```ts
export type PlaceOnBoardParams = {
    id: string;
    board: BoardInput;
};
```

### `PlaceOnBoardSchema`
```ts
export const PlaceOnBoardSchema: ZodType<PlaceOnBoardParams>;
```

### `RenamePinParams`
```ts
export type RenamePinParams = {
    id: string;
    pinId: string;
    name: string | null;
};
```

### `RenamePinSchema`
```ts
export const RenamePinSchema: ZodType<RenamePinParams>;
```

### `RotateParams`
```ts
export type RotateParams = {
    id: string;
    deltaDeg: number;
};
```

### `RotateSchema`
```ts
export const RotateSchema: ZodType<RotateParams>;
```

### `selectComponent`
```ts
export const selectComponent: (snapshot: Pick<Snapshot, "doc">, id: string) => {
    readonly id: string;
    readonly ref: string;
    readonly kind: "resistor" | "capacitor" | "capacitor_polarized" | "inductor" | "diode" | "led" | "zener" | "npn" | "pnp" | "nmos" | "pmos" | "regulator" | "ic" | "connector" | "crystal" | "switch" | "fuse" | "testpoint" | "via" | "pad" | "wire_point" | "hole" | "other";
    readonly marking: string;
    readonly value: string;
    readonly identified: boolean;
    readonly dnp: boolean;
    readonly note: string;
    readonly pins: readonly {
        readonly id: string;
        readonly uid: string;
        readonly nc: boolean;
        readonly name?: string | undefined;
    }[];
    readonly referenceImageId?: string | undefined;
    readonly board?: {
        readonly footprint: string;
        readonly params: {
            readonly [x: string]: string | number;
        };
        readonly center: {
            readonly x: number;
            readonly y: number;
        };
        readonly rotationDeg: number;
        readonly side: "top" | "bottom";
        readonly scaleX: number;
        readonly scaleY: number;
        readonly customPads: {
            readonly [x: string]: {
                readonly local: {
                    readonly x: number;
                    readonly y: number;
                };
                readonly sizeMm: number;
                readonly shape: "rect" | "circle";
                readonly through: boolean;
            };
        };
        readonly padMap?: {
            readonly [x: string]: string;
        } | undefined;
        readonly labelOffset?: {
            readonly x: number;
            readonly y: number;
        } | undefined;
    } | undefined;
    readonly schematic?: {
        readonly symbol: string;
        readonly at: {
            readonly x: number;
            readonly y: number;
        };
        readonly rot: 0 | 90 | 180 | 270;
        readonly mirror: boolean;
        readonly pinMap?: {
            readonly [x: string]: string;
        } | undefined;
        readonly labelOffset?: {
            readonly x: number;
            readonly y: number;
        } | undefined;
    } | undefined;
} | undefined;
```

### `selectComponents`
```ts
export const selectComponents: (snapshot: Pick<Snapshot, "doc">) => readonly {
    readonly id: string;
    readonly ref: string;
    readonly kind: "resistor" | "capacitor" | "capacitor_polarized" | "inductor" | "diode" | "led" | "zener" | "npn" | "pnp" | "nmos" | "pmos" | "regulator" | "ic" | "connector" | "crystal" | "switch" | "fuse" | "testpoint" | "via" | "pad" | "wire_point" | "hole" | "other";
    readonly marking: string;
    readonly value: string;
    readonly identified: boolean;
    readonly dnp: boolean;
    readonly note: string;
    readonly pins: readonly {
        readonly id: string;
        readonly uid: string;
        readonly nc: boolean;
        readonly name?: string | undefined;
    }[];
    readonly referenceImageId?: string | undefined;
    readonly board?: {
        readonly footprint: string;
        readonly params: {
            readonly [x: string]: string | number;
        };
        readonly center: {
            readonly x: number;
            readonly y: number;
        };
        readonly rotationDeg: number;
        readonly side: "top" | "bottom";
        readonly scaleX: number;
        readonly scaleY: number;
        readonly customPads: {
            readonly [x: string]: {
                readonly local: {
                    readonly x: number;
                    readonly y: number;
                };
                readonly sizeMm: number;
                readonly shape: "rect" | "circle";
                readonly through: boolean;
            };
        };
        readonly padMap?: {
            readonly [x: string]: string;
        } | undefined;
        readonly labelOffset?: {
            readonly x: number;
            readonly y: number;
        } | undefined;
    } | undefined;
    readonly schematic?: {
        readonly symbol: string;
        readonly at: {
            readonly x: number;
            readonly y: number;
        };
        readonly rot: 0 | 90 | 180 | 270;
        readonly mirror: boolean;
        readonly pinMap?: {
            readonly [x: string]: string;
        } | undefined;
        readonly labelOffset?: {
            readonly x: number;
            readonly y: number;
        } | undefined;
    } | undefined;
}[];
```

### `SetLabelOffsetParams`
```ts
export type SetLabelOffsetParams = {
    id: string;
    offset: { x: number; y: number; } | null;
};
```

### `SetLabelOffsetSchema`
```ts
export const SetLabelOffsetSchema: ZodType<SetLabelOffsetParams>;
```

### `SetNcParams`
```ts
export type SetNcParams = {
    id: string;
    pinId: string;
    nc: boolean;
};
```

### `SetNcSchema`
```ts
export const SetNcSchema: ZodType<SetNcParams>;
```

### `UpdateComponentParams`
```ts
export type UpdateComponentParams = {
    id: string;
    ref?: string | undefined;
    kind?: "resistor" | "capacitor" | "capacitor_polarized" | "inductor" | "diode" | "led" | "zener" | "npn" | "pnp" | "nmos" | "pmos" | "regulator" | "ic" | "connector" | "crystal" | "switch" | "fuse" | "testpoint" | "via" | "pad" | "wire_point" | "hole" | "other" | undefined;
    marking?: string | undefined;
    value?: string | undefined;
    note?: string | undefined;
    dnp?: boolean | undefined;
    identified?: boolean | undefined;
};
```

### `UpdateComponentSchema`
```ts
export const UpdateComponentSchema: ZodType<UpdateComponentParams>;
```
