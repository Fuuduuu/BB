<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/rules

Sisenemispunkt: `packages/domain/src/rules/index.ts`

### `attachJunctionToPin`
```ts
export function attachJunctionToPin(doc: BoardDoc, id: string, pin: PinRef): RuleReport;
```

### `BeepOutcome`
```ts
export type BeepOutcome = {
    kind: 'connected';
} | {
    kind: 'same_net';
} | {
    kind: 'guarded';
    reason: 'same_component' | 'shorts_component' | 'role_conflict';
    components: string[];
    roles: string[];
};
```

### `branchConnection`

Prepare all edits together so the preview and the command validate the same branch.

```ts
export function branchConnection(doc: DrawingPositions & {
    readonly connections: readonly BranchTarget[];
}, input: BranchInput): BranchPlan;
```

### `componentTopology`
```ts
export function componentTopology(components: readonly Component[]): readonly unknown[];
```

### `connectBeepPins`
```ts
export function connectBeepPins(doc: BoardDoc, { anchor, pin, connectionId }: {
    anchor: PinRef;
    pin: PinRef;
    connectionId: string;
}): BeepOutcome;
```

### `ConnectionLevel`
```ts
export type ConnectionLevel = {
    level: 'measured' | 'visual' | 'assumed';
    noContinuity?: true;
};
```

### `connectionLevels`
```ts
export function connectionLevels(doc: BoardDoc): Record<string, ConnectionLevel>;
```

### `createNetConnectivity`
```ts
export function createNetConnectivity(doc: BoardDoc, endpoints?: ReadonlyMap<string, {
    pin: {
        c: string;
        p: string;
    };
} | {
    junction: string;
}>): {
    keys: readonly string[];
    find: (key: string) => string | undefined;
    union: (left: string, right: string) => void;
};
```

### `deleteItems`
```ts
export function deleteItems(doc: BoardDoc, ids: readonly string[]): RuleReport;
```

### `describeNets`
```ts
export function describeNets(doc: BoardDoc): NetsDerived;
```

### `DrawingKind`
```ts
export type DrawingKind = NonNullable<Connection['board']>['kind'];
```

### `endAcceptsDrawing`
```ts
export function endAcceptsDrawing(doc: DrawingPositions, end: EndRef, kind: DrawingKind, layer: Layer): boolean;
```

### `endKey`
```ts
export const endKey: (end: EndRef) => string;
```

### `endRefsByKey`
```ts
export function endRefsByKey(doc: BoardDoc): ReadonlyMap<string, EndRef>;
```

### `flipComponentSides`
```ts
export function flipComponentSides(doc: BoardDoc, ids: readonly string[]): void;
```

### `Invariant`
```ts
export interface Invariant {
    id: string;
    inputs: readonly DocKey[];
    check(doc: BoardDoc): Issue[];
}
```

### `INVARIANTS`
```ts
export const INVARIANTS: readonly Invariant[];
```

### `isEmptyReport`
```ts
export function isEmptyReport(report: RuleReport): boolean;
```

### `Issue`
```ts
export interface Issue {
    path: (string | number)[];
    code: string;
}
```

### `ITEM_FIELDS`
```ts
export const ITEM_FIELDS: readonly [
    "components",
    "connections",
    "junctions",
    "netLabels"
];
```

### `ItemRef`
```ts
export type ItemRef = {
    kind: "component";
    id: string;
};
```

### `ItemRefSchema`
```ts
export const ItemRefSchema: ZodType<ItemRef>;
```

### `NetInfo`
```ts
export interface NetInfo {
    key: string;
    members: string[];
    name: string;
    named: boolean;
    roleId?: string;
    roleConflict: boolean;
    conflictingRoles: string[];
    beepContradiction: boolean;
}
```

### `NetMembership`
```ts
export interface NetMembership {
    netOf: ReadonlyMap<string, string>;
    members: ReadonlyMap<string, readonly string[]>;
}
```

### `NetsDerived`
```ts
export interface NetsDerived {
    list: NetInfo[];
    netOf: Record<string, string>;
    shortedComponents: string[];
}
```

### `PhysicalPin`
```ts
export type PhysicalPin = {
    id: string;
    padIndex: number;
};
```

### `pinKey`
```ts
export const pinKey: (ref: PinRef) => string;
```

### `pinSpacingMm`
```ts
export function pinSpacingMm(board: BoardPlacement, pinA: PhysicalPin, pinB: PhysicalPin): number | undefined;
```

### `removeBoardDrawing`
```ts
export function removeBoardDrawing(doc: BoardDoc, ids: readonly string[]): void;
```

### `removeConnections`
```ts
export function removeConnections(doc: BoardDoc, ids: readonly string[]): RuleReport;
```

### `removeJunctions`
```ts
export function removeJunctions(doc: BoardDoc, ids: readonly string[]): RuleReport;
```

### `removePins`
```ts
export function removePins(doc: BoardDoc, componentId: string, pinIds: readonly string[]): RuleReport;
```

### `resolveNets`
```ts
export function resolveNets(doc: BoardDoc): NetMembership;
```

### `RuleRejected`
```ts
export class RuleRejected extends Error {
    readonly reason: string;
    name: string;
    constructor(reason: string);
}
```

### `RuleReport`
```ts
export interface RuleReport {
    removedLabels: NetLabel[];
    removedConnections?: number;
}
```

### `RuleTargetNotFound`
```ts
export class RuleTargetNotFound extends Error {
    readonly id: string;
    name: string;
    constructor(id: string);
}
```

### `scaleFromPins`
```ts
export function scaleFromPins(doc: BoardDoc, { componentId, pinA, pinB, targetA, targetB, mm, }: {
    componentId: string;
    pinA: PhysicalPin;
    pinB: PhysicalPin;
    targetA: Vec2;
    targetB: Vec2;
    mm: number;
}): void;
```

### `translateItems`
```ts
export function translateItems(doc: BoardDoc, items: readonly ItemRef[], delta: Vec2): void;
```

### `validateJunctionAttachment`
```ts
export function validateJunctionAttachment(doc: DrawingPositions & {
    readonly connections: readonly AttachmentConnection[];
}, id: string, pin: PinRef): void;
```
