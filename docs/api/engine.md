<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/engine

Sisenemispunkt: `packages/engine/src/index.ts`

### `buildRegistry`
```ts
export function buildRegistry(modules: EngineModule[], reserved?: DocKey[]): {
    commands: Map<string, RegisteredCommand>;
    derive: DeriveSpec[];
    reserved: Set<"name" | "junctions" | "format_version" | "rev" | "device" | "problem" | "status" | "mappedAt" | "mappedSnapshot" | "scale" | "photos" | "activePhotoId" | "components" | "connections" | "netLabels" | "roles" | "measurements" | "measureSettings" | "repairs" | "areas" | "dimensions" | "outline" | "textNotes" | "importChecks" | "guide">;
};
```

### `Clock`
```ts
export interface Clock {
    now(): string;
}
```

### `CommandCtx`
```ts
export interface CommandCtx {
    readonly derived: DeepReadonly<Derived>;
    emit(event: PendingEvent): void;
}
```

### `CommandRejected`
```ts
export class CommandRejected extends Error {
    readonly reason: string;
    name: string;
    constructor(reason: string);
}
```

### `CommandSpec`
```ts
export interface CommandSpec<P> {
    id: `${string}.${string}`;
    title: string;
    params: z.ZodType<P>;
    run(draft: Draft<BoardDoc>, params: P, ctx: CommandCtx): void;
    alsoWrites?: DocKey[];
    summary?(params: P, doc: BoardDoc): string;
}
```

### `CommandTargetNotFound`
```ts
export class CommandTargetNotFound extends Error {
    readonly id: string;
    name: string;
    constructor(id: string);
}
```

### `CopyProjectReq`
```ts
export type CopyProjectReq = CopyReq & {
    session: string;
    projectId: string;
    copiedFromProjectId?: string;
    doc: BoardDoc;
    rev: number;
    view: ViewState | null;
    journal: JournalEntry[];
};
```

### `createEngine`
```ts
export function createEngine(opts: {
    modules: EngineModule[];
    clock: Clock;
    reserved?: DocKey[];
    onInternalError?(error: unknown, commandId: string): void;
}): {
    engine: DocumentEngine;
    host: EngineHost;
};
```

### `CreateProjectReq`
```ts
export type CreateProjectReq = CreateReq & {
    projectId: string;
    doc: BoardDoc;
};
```

### `createProjectService`
```ts
export function createProjectService(opts: {
    engine: DocumentEngine;
    host: EngineHost;
    repo: ProjectRepository;
    photos: Pick<PhotoStore, 'prune' | 'url' | 'importBytes'>;
    clock: Clock;
    ids: IdGen;
    timing?: {
        debounceMs: number;
        maxWaitMs: number;
    };
}): ProjectService;
```

### `DeriveSpec`
```ts
export type DeriveSpec<K extends keyof Derived = keyof Derived> = {
    [Key in K]: {
        key: Key;
        inputs: DocKey[];
        schema: z.ZodType<Derived[Key]>;
        initial: Derived[Key];
        run(doc: DeepReadonly<BoardDoc>, derived: DeepReadonly<Derived>): Derived[Key];
    };
}[K];
```

### `EngineHost`
```ts
export interface EngineHost {
    load(sessionId: string, doc: BoardDoc, readOnly: boolean): void;
    unload(): void;
    current(): {
        sessionId: string;
        rev: number;
        doc: BoardDoc;
    } | null;
    drainJournal(): JournalEntry[];
    requeueJournal(entries: JournalEntry[]): void;
}
```

### `EngineModule`
```ts
export interface EngineModule {
    id: string;
    dependsOn?: string[];
    owns?: DocKey[];
    commands?: CommandSpec<any>[];
    derive?: DeriveSpec[];
}
```

### `IdGen`
```ts
export interface IdGen {
    newId(prefix: string): string;
}
```

### `JournalEntry`
```ts
export type JournalEntry = {
    at: string;
    kind: 'command' | 'undo' | 'redo';
    commandId: string;
    requestId?: string;
    source: 'user';
    summary: string;
};
```

### `OpenedProject`
```ts
export type OpenedProject = {
    session: string;
    projectId: string;
    fileId: string;
    path: string;
    doc: unknown;
    view: ViewState | null;
    formatVersion: number;
    readOnly: boolean;
    savedAt?: string;
};
```

### `PendingEvent`
```ts
export type PendingEvent = Pick<DomainEvent, 'type' | 'payload'>;
```

### `PhotoStore`
```ts
export interface PhotoStore {
    importPath(session: string, path: string, id: string): Promise<PhotoRef>;
    importBytes(session: string, bytes: ArrayBuffer, id: string, name: string): Promise<PhotoRef>;
    prune(session: string, keep: string[]): Promise<void>;
    url(session: string, id: string, variant: 'display' | 'original'): string;
}
```

### `ProjectRepository`
```ts
export interface ProjectRepository {
    create(req: CreateProjectReq): Promise<OpenedProject>;
    open(path: string): Promise<OpenedProject>;
    save(req: SaveReq): Promise<void>;
    saveView(session: string, view: ViewState): Promise<void>;
    copy(req: CopyProjectReq): Promise<OpenedProject & {
        fromMemory: boolean;
    }>;
    backupFull(session: string, reason: 'migration'): Promise<void>;
    backups(projectId: string): Promise<BackupInfo[]>;
    restore(req: RestoreReq): Promise<OpenedProject>;
    close(session: string): Promise<void>;
}
```

### `RegistryError`
```ts
export class RegistryError extends Error {
    name: string;
}
```

### `reject`
```ts
export function reject(reason: string): never;
```

### `SaveReq`
```ts
export type SaveReq = {
    session: string;
    baseRev: number;
    rev: number;
    doc: BoardDoc;
    journal: JournalEntry[];
};
```

### `StorageError`
```ts
export class StorageError extends Error {
    readonly reason: StorageReason;
    readonly actualRev?: number | undefined;
    name: string;
    constructor(reason: StorageReason, actualRev?: number | undefined);
}
```
