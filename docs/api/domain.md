<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain

Sisenemispunkt: `packages/domain/src/index.ts`

### `BACKUP_KEEP`
```ts
export const BACKUP_KEEP: 5;
```

### `BoardDoc`
```ts
export type BoardDoc = {
    format_version: 1;
    rev: number;
    name: string;
    status: "mapping" | "mapped";
    scale: { pxPerMm: number; calibrated: boolean; calib?: { a: Vec2; b: Vec2; mm: number; } | undefined; };
    photos: PhotoRef[];
    components: Component[];
    junctions: Junction[];
    connections: Connection[];
    netLabels: NetLabel[];
    roles: NetRole[];
    measurements: Measurement[];
    measureSettings: { voltageTolerancePct: number; voltageToleranceMinV: number; };
    repairs: RepairAction[];
    areas: DamageArea[];
    dimensions: Dimension[];
    textNotes: TextNote[];
    importChecks: ImportCheck[];
    guide: { skipped: string[]; };
    device?: string | undefined;
    problem?: string | undefined;
    mappedAt?: string | undefined;
    mappedSnapshot?: ProgressSnapshot | undefined;
    activePhotoId?: string | undefined;
    outline?: BoardOutline | undefined;
};
```

### `BoardDocSchema`
```ts
export const BoardDocSchema: ZodType<BoardDoc>;
```

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

### `BoardPlacement`
```ts
export type BoardPlacement = {
    footprint: string;
    params: Record<string, string | number>;
    center: Vec2;
    rotationDeg: number;
    side: "top" | "bottom";
    scaleX: number;
    scaleY: number;
    customPads: Record<string, { local: Vec2; sizeMm: number; shape: "rect" | "circle"; through: boolean; }>;
    padMap?: Record<string, string> | undefined;
    labelOffset?: Vec2 | undefined;
};
```

### `BoardPlacementSchema`
```ts
export const BoardPlacementSchema: ZodType<BoardPlacement>;
```

### `Component`
```ts
export type Component = {
    id: string;
    ref: string;
    kind: ComponentKind;
    marking: string;
    value: string;
    identified: boolean;
    dnp: boolean;
    note: string;
    pins: Pin[];
    referenceImageId?: string | undefined;
    board?: BoardPlacement | undefined;
    schematic?: SymbolPlacement | undefined;
};
```

### `ComponentKind`
```ts
export type ComponentKind = "resistor" | "capacitor" | "capacitor_polarized" | "inductor" | "diode" | "led" | "zener" | "npn" | "pnp" | "nmos" | "pmos" | "regulator" | "ic" | "connector" | "crystal" | "switch" | "fuse" | "testpoint" | "via" | "pad" | "wire_point" | "hole" | "other";
```

### `ComponentKindSchema`
```ts
export const ComponentKindSchema: ZodType<ComponentKind>;
```

### `ComponentSchema`
```ts
export const ComponentSchema: ZodType<Component>;
```

### `Connection`
```ts
export type Connection = {
    id: string;
    a: EndRef;
    b: EndRef;
    basis: "assumed" | "visual";
    board?: { kind: "trace" | "wire"; layer: "top" | "bottom"; waypoints: Vec2[]; widthMm: number; labelOffset?: Vec2 | undefined; } | undefined;
    schematic?: { waypoints: Vec2[]; } | undefined;
};
```

### `ConnectionSchema`
```ts
export const ConnectionSchema: ZodType<Connection>;
```

### `CountSchema`
```ts
export const CountSchema: ZodType<number>;
```

### `CURRENT_FORMAT_VERSION`
```ts
export const CURRENT_FORMAT_VERSION: 1;
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

### `DEFAULT_ROLES`
```ts
export const DEFAULT_ROLES: readonly [
    {
        readonly id: "rol_gnd";
        readonly label: "GND";
        readonly kind: "ground";
        readonly nominalV: 0;
        readonly color: "#1f2523";
    },
    {
        readonly id: "rol_3v3";
        readonly label: "3V3";
        readonly kind: "power";
        readonly nominalV: 3.3;
        readonly color: "#e8891c";
    },
    {
        readonly id: "rol_5v";
        readonly label: "5V";
        readonly kind: "power";
        readonly nominalV: 5;
        readonly color: "#d9342b";
    },
    {
        readonly id: "rol_12v";
        readonly label: "12V";
        readonly kind: "power";
        readonly nominalV: 12;
        readonly color: "#2a64d6";
    },
    {
        readonly id: "rol_sig";
        readonly label: "Signaal";
        readonly kind: "signal";
        readonly color: "#8a4fd3";
    },
    {
        readonly id: "rol_unk";
        readonly label: "Teadmata";
        readonly kind: "unknown";
        readonly color: "#8c9692";
    }
];
```

### `defaultPinIds`
```ts
export function defaultPinIds(kind: ComponentKind, pinCount?: number): string[];
```

### `DimEnd`
```ts
export type DimEnd = { pin: PinRef; } | { point: Vec2; };
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

### `DOC_BACKUP_INTERVAL_MS`
```ts
export const DOC_BACKUP_INTERVAL_MS: 1800000;
```

### `DocKey`
```ts
export type DocKey = keyof BoardDoc;
```

### `EndRef`
```ts
export type EndRef = { pin: PinRef; } | { junction: string; };
```

### `EndRefSchema`
```ts
export const EndRefSchema: ZodType<EndRef>;
```

### `HISTORY_LIMIT`
```ts
export const HISTORY_LIMIT: 200;
```

### `IdPrefix`
```ts
export type IdPrefix = 'cmp' | 'jun' | 'con' | 'lbl' | 'rol' | 'msr' | 'rep' | 'pho' | 'dim' | 'are' | 'att' | 'txt' | 'chk' | 'pin';
```

### `IdSchema`
```ts
export const IdSchema: ZodType<string>;
```

### `ImportCheck`
```ts
export type ImportCheck = {
    id: string;
    at: Vec2;
    layer: "top" | "bottom";
    junctions: string[];
    note: string;
};
```

### `ImportCheckSchema`
```ts
export const ImportCheckSchema: ZodType<ImportCheck>;
```

### `Junction`
```ts
export type Junction = {
    id: string;
    board?: { at: Vec2; layer: "top" | "bottom"; } | undefined;
    schematic?: { at: Vec2; } | undefined;
};
```

### `JunctionSchema`
```ts
export const JunctionSchema: ZodType<Junction>;
```

### `Layer`
```ts
export type Layer = "top" | "bottom";
```

### `LayerSchema`
```ts
export const LayerSchema: ZodType<Layer>;
```

### `MeasuredPin`
```ts
export type MeasuredPin = {
    c: string;
    p: string;
    uid: string;
};
```

### `MeasuredPinSchema`
```ts
export const MeasuredPinSchema: ZodType<MeasuredPin>;
```

### `Measurement`
```ts
export type Measurement = {
    id: string;
    mode: "diode" | "voltage" | "resistance" | "continuity";
    at: MeasuredPin;
    power: "unknown" | "on" | "off";
    takenAt: string;
    atLabel: string;
    source: "manual" | "beep_mode";
    ref?: MeasuredPin | undefined;
    value?: number | undefined;
    overload?: boolean | undefined;
    beep?: boolean | undefined;
    note?: string | undefined;
    refLabel?: string | undefined;
    staleByRepairId?: string | undefined;
};
```

### `MeasurementSchema`
```ts
export const MeasurementSchema: ZodType<Measurement>;
```

### `migrateDoc`
```ts
export function migrateDoc(raw: unknown, from: number, migrations?: Migration[]): unknown;
```

### `Migration`
```ts
export type Migration = {
    from: number;
    up(doc: unknown): unknown;
};
```

### `MIGRATIONS`
```ts
export const MIGRATIONS: Migration[];
```

### `NetLabel`
```ts
export type NetLabel = {
    id: string;
    anchor: EndRef;
    source: "user" | "import";
    name?: string | undefined;
    roleId?: string | undefined;
};
```

### `NetLabelSchema`
```ts
export const NetLabelSchema: ZodType<NetLabel>;
```

### `NetRole`
```ts
export type NetRole = {
    id: string;
    label: string;
    kind: "unknown" | "ground" | "power" | "signal";
    color: string;
    nominalV?: number | undefined;
};
```

### `NetRoleSchema`
```ts
export const NetRoleSchema: ZodType<NetRole>;
```

### `newBoardDoc`
```ts
export function newBoardDoc(name: string): BoardDoc;
```

### `newId`
```ts
export function newId(prefix: IdPrefix): string;
```

### `nextRef`
```ts
export function nextRef(doc: BoardDoc, kind: ComponentKind): string;
```

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

### `Pin`
```ts
export type Pin = {
    id: string;
    uid: string;
    nc: boolean;
    name?: string | undefined;
};
```

### `PinRef`
```ts
export type PinRef = {
    c: string;
    p: string;
};
```

### `PinRefSchema`
```ts
export const PinRefSchema: ZodType<PinRef>;
```

### `PinSchema`
```ts
export const PinSchema: ZodType<Pin>;
```

### `ProgressSnapshot`
```ts
export type ProgressSnapshot = {
    componentsIdentified: [
        number,
        number
    ];
    pinsMapped: [
        number,
        number
    ];
    unplaced: { board: number; schematic: number; };
    powerDefined: boolean;
    assumedConnections: number;
    roleConflicts: number;
    openImportChecks: number;
    suspectMeasurements: number;
};
```

### `ProgressSnapshotSchema`
```ts
export const ProgressSnapshotSchema: ZodType<ProgressSnapshot>;
```

### `refPrefix`
```ts
export function refPrefix(kind: ComponentKind): string;
```

### `RepairAction`
```ts
export type RepairAction = {
    id: string;
    action: "other" | "replaced" | "removed" | "reflowed" | "trace_fixed" | "cleaned";
    text: string;
    at: string;
    affects: { component: string; } | { nets: (EndRef)[]; } | { wholeBoard: true; } | { nothing: true; };
};
```

### `RepairActionSchema`
```ts
export const RepairActionSchema: ZodType<RepairAction>;
```

### `SAVE_DEBOUNCE_MS`
```ts
export const SAVE_DEBOUNCE_MS: 1500;
```

### `SAVE_MAX_WAIT_MS`
```ts
export const SAVE_MAX_WAIT_MS: 10000;
```

### `Side`
```ts
export type Side = "top" | "bottom";
```

### `SideSchema`
```ts
export const SideSchema: ZodType<Side>;
```

### `SymbolPlacement`
```ts
export type SymbolPlacement = {
    symbol: string;
    at: Vec2;
    rot: 0 | 90 | 180 | 270;
    mirror: boolean;
    pinMap?: Record<string, string> | undefined;
    labelOffset?: Vec2 | undefined;
};
```

### `SymbolPlacementSchema`
```ts
export const SymbolPlacementSchema: ZodType<SymbolPlacement>;
```

### `TextNote`
```ts
export type TextNote = {
    id: string;
    view: "board" | "schematic";
    at: Vec2;
    text: string;
    anchor?: { component: string; } | { connection: string; } | { junction: string; } | undefined;
};
```

### `TextNoteSchema`
```ts
export const TextNoteSchema: ZodType<TextNote>;
```

### `TimestampSchema`
```ts
export const TimestampSchema: ZodType<string>;
```

### `Vec2`
```ts
export type Vec2 = {
    x: number;
    y: number;
};
```

### `Vec2Schema`
```ts
export const Vec2Schema: ZodType<Vec2>;
```
