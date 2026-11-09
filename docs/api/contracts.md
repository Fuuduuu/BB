<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/contracts

Sisenemispunkt: `packages/contracts/src/index.ts`

### `AppHost`
```ts
export interface AppHost {
    readonly kind: 'web' | 'desktop';
    recents(): Promise<RecentProject[]>;
    removeRecent(path: string): Promise<void>;
    listOpenable?(): Promise<RecentProject[]>;
    pickProjectFile?(): Promise<string | null>;
    pickSavePath?(suggestedName: string): Promise<string | null>;
    recoveryCopyPath?(projectPath: string): Promise<string>;
    onCloseRequested(handler: () => Promise<boolean>): Unsubscribe;
    onOpenPath(handler: (path: string) => void): Unsubscribe;
    protectBeforeUnload?(shouldWarn: () => boolean): Unsubscribe;
    closeNow(): void;
    reload(): void;
    saveDiagnostics(summary: string): Promise<void>;
}
```

### `BackupInfo`
```ts
export type BackupInfo = {
    file: string;
    kind: 'full' | 'doc';
    at: string;
    base?: string;
};
```

### `CommandId`
```ts
export type CommandId = Extract<keyof CommandMap, `${string}.${string}`>;
```

### `CommandMap`
```ts
export interface CommandMap {
    'items.delete': {
        ids: string[];
    };
}
```

### `CommandOk`
```ts
export type CommandOk = {
    rev: number;
};
```

### `CopyReq`
```ts
export type CopyReq = {
    dest: string;
    identity: 'same' | 'new';
};
```

### `CreateReq`
```ts
export type CreateReq = {
    name: string;
    device?: string;
    problem?: string;
    path?: string;
};
```

### `DeepReadonly`
```ts
export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> : T extends ReadonlySet<infer U> ? ReadonlySet<DeepReadonly<U>> : T extends object ? {
    readonly [K in keyof T]: DeepReadonly<T[K]>;
} : T;
```

### `DEFAULT_VIEW_STATE`
```ts
export const DEFAULT_VIEW_STATE: Readonly<ViewState>;
```

### `Derived`
```ts
export interface Derived {
    unplacedBoard: string[];
    unplacedSchematic: string[];
}
```

### `DocumentEngine`
```ts
export interface DocumentEngine {
    execute<C extends CommandId>(id: C, params: ParamsOf<C>, opts?: {
        requestId?: string;
    }): Result<CommandOk, EngineError>;
    undo(): Result<CommandOk, EngineError>;
    redo(): Result<CommandOk, EngineError>;
    snapshot(): Snapshot;
    subscribe(fn: (s: Snapshot) => void): Unsubscribe;
    events(fn: (e: DomainEvent) => void): Unsubscribe;
}
```

### `DomainEvent`
```ts
export interface DomainEvent {
    readonly type: `${string}.${string}`;
    readonly sessionId: string;
    readonly rev: number;
    readonly payload: unknown;
}
```

### `EngineError`
```ts
export type EngineError = {
    code: 'validation';
    issues: ZodIssue[];
} | {
    code: 'ownership';
    field: DocKey;
    command: CommandId;
} | {
    code: 'not_found';
    id: string;
} | {
    code: 'read_only';
} | {
    code: 'stale_rev';
    expected: number;
    actual: number;
} | {
    code: 'stale_session';
} | {
    code: 'storage';
    reason: StorageReason;
};
```

### `err`
```ts
export function err<E>(error: E): {
    ok: false;
    error: E;
};
```

### `IdGen`
```ts
export interface IdGen {
    newId(prefix: string): string;
}
```

### `ok`
```ts
export function ok<T>(value: T): {
    ok: true;
    value: T;
};
```

### `OpenReq`
```ts
export type OpenReq = {
    path: string;
};
```

### `ParamsOf`
```ts
export type ParamsOf<C extends CommandId> = CommandMap[C];
```

### `parseViewState`

Optional view metadata must never make an otherwise valid project unreadable.

```ts
export function parseViewState(input: unknown): ViewState | null;
```

### `ProjectInfo`
```ts
export type ProjectInfo = {
    projectId: string;
    sessionId: string;
    name: string;
    path: string;
    readOnly: boolean;
    view: ViewState | null;
};
```

### `ProjectService`
```ts
export interface ProjectService {
    create(req: CreateReq): Promise<Result<ProjectInfo, EngineError>>;
    open(req: OpenReq): Promise<Result<ProjectInfo, EngineError>>;
    close(): Promise<Result<void, EngineError>>;
    discard(): Promise<Result<void, EngineError>>;
    flush(): Promise<Result<void, EngineError>>;
    saveView(view: ViewState): void;
    copy(req: CopyReq): Promise<Result<ProjectInfo, EngineError>>;
    backups(): Promise<Result<BackupInfo[], EngineError>>;
    restore(req: RestoreReq): Promise<Result<ProjectInfo, EngineError>>;
    status(fn: (s: SaveStatus & {
        sessionId: string;
    }) => void): Unsubscribe;
}
```

### `RecentProject`
```ts
export interface RecentProject {
    path: string;
    projectId: string;
    name: string;
    device?: string;
    updatedAt: string;
    missing?: boolean;
}
```

### `RestoreReq`
```ts
export type RestoreReq = {
    backup: string;
    dest: string;
};
```

### `Result`
```ts
export type Result<T, E> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
```

### `SaveStatus`
```ts
export type SaveStatus = {
    state: 'saved';
    rev: number;
    at: string;
} | {
    state: 'pending';
} | {
    state: 'saving';
} | {
    state: 'error';
    reason: StorageReason;
};
```

### `Snapshot`
```ts
export interface Snapshot {
    readonly sessionId: string;
    readonly rev: number;
    readonly doc: DeepReadonly<BoardDoc>;
    readonly derived: DeepReadonly<Derived>;
    readonly history: DeepReadonly<{
        canUndo: boolean;
        canRedo: boolean;
    }>;
}
```

### `StorageReason`
```ts
export type StorageReason = 'disk_full' | 'read_only' | 'missing' | 'locked' | 'not_project' | 'too_new' | 'unknown';
```

### `Unsubscribe`
```ts
export type Unsubscribe = () => void;
```

### `ViewState`
```ts
export type ViewState = {
    navigatorWidth: number;
    navigatorTab: string;
    contextWidth: number;
    contextOpen: boolean;
};
```
