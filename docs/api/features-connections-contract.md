<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/features-connections-contract

Sisenemispunkt: `packages/features/connections/contract.ts`

### `AddConnectionsParams`
```ts
export type AddConnectionsParams = {
    items: { id: string; a: { pin: { c: string; p: string; }; } | { junction: string; }; b: { pin: { c: string; p: string; }; } | { junction: string; }; board?: { kind: "trace" | "wire"; layer: "top" | "bottom"; waypoints: { x: number; y: number; }[]; widthMm: number; } | undefined; }[];
    basis: "assumed" | "visual";
    skipJoined: boolean;
    junctions?: { id: string; board: { at: { x: number; y: number; }; layer: "top" | "bottom"; }; }[] | undefined;
};
```

### `AddConnectionsSchema`
```ts
export const AddConnectionsSchema: ZodType<AddConnectionsParams>;
```

### `AttachJunctionToPinParams`
```ts
export type AttachJunctionToPinParams = {
    id: string;
    pin: { c: string; p: string; };
};
```

### `AttachJunctionToPinSchema`
```ts
export const AttachJunctionToPinSchema: ZodType<AttachJunctionToPinParams>;
```

### `BranchConnectionParams`
```ts
export type BranchConnectionParams = {
    target: string;
    segment: number;
    at: { x: number; y: number; };
    junctionId: string;
    splitId: string;
    trace: { id: string; a: { pin: { c: string; p: string; }; } | { junction: string; }; b: { pin: { c: string; p: string; }; } | { junction: string; }; board?: { kind: "trace" | "wire"; layer: "top" | "bottom"; waypoints: { x: number; y: number; }[]; widthMm: number; } | undefined; };
};
```

### `BranchConnectionSchema`
```ts
export const BranchConnectionSchema: ZodType<BranchConnectionParams>;
```

### `ConnectionIdsParams`
```ts
export type ConnectionIdsParams = {
    ids: string[];
};
```

### `ConnectionIdsSchema`
```ts
export const ConnectionIdsSchema: ZodType<ConnectionIdsParams>;
```

### `DrawOnBoardParams`
```ts
export type DrawOnBoardParams = {
    id: string;
    board: { kind: "trace" | "wire"; layer: "top" | "bottom"; waypoints: { x: number; y: number; }[]; widthMm: number; };
};
```

### `DrawOnBoardSchema`
```ts
export const DrawOnBoardSchema: ZodType<DrawOnBoardParams>;
```

### `InsertWaypointParams`
```ts
export type InsertWaypointParams = {
    id: string;
    index: number;
    at: { x: number; y: number; };
};
```

### `InsertWaypointSchema`
```ts
export const InsertWaypointSchema: ZodType<InsertWaypointParams>;
```

### `MoveJunctionParams`
```ts
export type MoveJunctionParams = {
    id: string;
    at: { x: number; y: number; };
};
```

### `MoveJunctionSchema`
```ts
export const MoveJunctionSchema: ZodType<MoveJunctionParams>;
```

### `RemoveWaypointParams`
```ts
export type RemoveWaypointParams = {
    id: string;
    index: number;
};
```

### `RemoveWaypointSchema`
```ts
export const RemoveWaypointSchema: ZodType<RemoveWaypointParams>;
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

### `TRACE_WIDTH_MM`
```ts
export const TRACE_WIDTH_MM: 0.3;
```

### `UpdateConnectionParams`
```ts
export type UpdateConnectionParams = {
    id: string;
    waypoints: { x: number; y: number; }[];
};
```

### `UpdateConnectionSchema`
```ts
export const UpdateConnectionSchema: ZodType<UpdateConnectionParams>;
```

### `WIRE_WIDTH_MM`
```ts
export const WIRE_WIDTH_MM: 0.5;
```
