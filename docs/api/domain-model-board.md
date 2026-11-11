<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/model

Sisenemispunkt: `packages/domain/src/model/board.ts`

### `BoardDoc`
```ts
export type BoardDoc = {
    format_version: 1;
    rev: number;
    name: string;
    status: "mapping" | "mapped";
    scale: { pxPerMm: number; calibrated: boolean; calib?: { a: { x: number; y: number; }; b: { x: number; y: number; }; mm: number; } | undefined; };
    photos: { id: string; side: "top" | "bottom"; name: string; widthPx: number; heightPx: number; transform: "mirror" | "none" | "rot90" | "rot180" | "rot270" | "mirror_rot90" | "mirror_rot180" | "mirror_rot270"; toBoard?: [
        number,
        number,
        number,
        number,
        number,
        number
    ] | undefined; }[];
    components: { id: string; ref: string; kind: "resistor" | "capacitor" | "capacitor_polarized" | "inductor" | "diode" | "led" | "zener" | "npn" | "pnp" | "nmos" | "pmos" | "regulator" | "ic" | "connector" | "crystal" | "switch" | "fuse" | "testpoint" | "via" | "pad" | "wire_point" | "hole" | "other"; marking: string; value: string; identified: boolean; dnp: boolean; note: string; pins: { id: string; uid: string; nc: boolean; name?: string | undefined; }[]; referenceImageId?: string | undefined; board?: { footprint: string; params: Record<string, string | number>; center: { x: number; y: number; }; rotationDeg: number; side: "top" | "bottom"; scaleX: number; scaleY: number; customPads: Record<string, { local: { x: number; y: number; }; sizeMm: number; shape: "rect" | "circle"; through: boolean; }>; padMap?: Record<string, string> | undefined; labelOffset?: { x: number; y: number; } | undefined; } | undefined; schematic?: { symbol: string; at: { x: number; y: number; }; rot: 0 | 90 | 180 | 270; mirror: boolean; pinMap?: Record<string, string> | undefined; labelOffset?: { x: number; y: number; } | undefined; } | undefined; }[];
    junctions: { id: string; board?: { at: { x: number; y: number; }; layer: "top" | "bottom"; } | undefined; schematic?: { at: { x: number; y: number; }; } | undefined; }[];
    connections: { id: string; a: { pin: { c: string; p: string; }; } | { junction: string; }; b: { pin: { c: string; p: string; }; } | { junction: string; }; basis: "assumed" | "visual"; board?: { kind: "trace" | "wire"; layer: "top" | "bottom"; waypoints: { x: number; y: number; }[]; widthMm: number; labelOffset?: { x: number; y: number; } | undefined; } | undefined; schematic?: { waypoints: { x: number; y: number; }[]; } | undefined; }[];
    netLabels: { id: string; anchor: { pin: { c: string; p: string; }; } | { junction: string; }; source: "user" | "import"; name?: string | undefined; roleId?: string | undefined; }[];
    roles: { id: string; label: string; kind: "unknown" | "ground" | "power" | "signal"; color: string; nominalV?: number | undefined; }[];
    measurements: { id: string; mode: "diode" | "voltage" | "resistance" | "continuity"; at: { c: string; p: string; uid: string; }; power: "unknown" | "on" | "off"; takenAt: string; atLabel: string; source: "manual" | "beep_mode"; ref?: { c: string; p: string; uid: string; } | undefined; value?: number | undefined; overload?: boolean | undefined; beep?: boolean | undefined; note?: string | undefined; refLabel?: string | undefined; staleByRepairId?: string | undefined; }[];
    measureSettings: { voltageTolerancePct: number; voltageToleranceMinV: number; };
    repairs: { id: string; action: "other" | "replaced" | "removed" | "reflowed" | "trace_fixed" | "cleaned"; text: string; at: string; affects: { component: string; } | { nets: ({ pin: { c: string; p: string; }; } | { junction: string; })[]; } | { wholeBoard: true; } | { nothing: true; }; }[];
    areas: { id: string; shape: "rect" | "ellipse"; x: number; y: number; w: number; h: number; text: string; }[];
    dimensions: { id: string; a: { pin: { c: string; p: string; }; } | { point: { x: number; y: number; }; }; b: { pin: { c: string; p: string; }; } | { point: { x: number; y: number; }; }; offsetPx: number; }[];
    textNotes: { id: string; view: "board" | "schematic"; at: { x: number; y: number; }; text: string; anchor?: { component: string; } | { connection: string; } | { junction: string; } | undefined; }[];
    importChecks: { id: string; at: { x: number; y: number; }; layer: "top" | "bottom"; junctions: string[]; note: string; }[];
    guide: { skipped: string[]; };
    device?: string | undefined;
    problem?: string | undefined;
    mappedAt?: string | undefined;
    mappedSnapshot?: { componentsIdentified: [
        number,
        number
    ]; pinsMapped: [
        number,
        number
    ]; unplaced: { board: number; schematic: number; }; powerDefined: boolean; assumedConnections: number; roleConflicts: number; openImportChecks: number; suspectMeasurements: number; } | undefined;
    activePhotoId?: string | undefined;
    outline?: { x: number; y: number; w: number; h: number; showDims: boolean; } | undefined;
};
```

### `BoardDocSchema`
```ts
export const BoardDocSchema: ZodType<BoardDoc>;
```

### `DocKey`
```ts
export type DocKey = keyof BoardDoc;
```
