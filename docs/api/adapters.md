<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/adapters

Sisenemispunkt: `packages/adapters/src/index.ts`

### `createMemoryRepository`
```ts
export function createMemoryRepository(store?: MemoryStore): {
    failNext(reason: StorageReason): void;
    setReadOnly(path: string, readOnly: boolean): void;
    documentWrites: number;
    viewWrites: number;
    create(req: import("@pcbk/engine").CreateProjectReq): Promise<import("@pcbk/engine").OpenedProject>;
    open(path: string): Promise<import("@pcbk/engine").OpenedProject>;
    save(req: import("@pcbk/engine").SaveReq): Promise<void>;
    saveView(session: string, view: ViewState): Promise<void>;
    copy(req: import("@pcbk/engine").CopyProjectReq): Promise<import("@pcbk/engine").OpenedProject>;
    backupFull(session: string, reason: "migration"): Promise<void>;
    backups(projectId: string): Promise<BackupInfo[]>;
    restore(req: import("@pcbk/contracts").RestoreReq): Promise<import("@pcbk/engine").OpenedProject>;
    close(session: string): Promise<void>;
};
```

### `createMemoryStore`
```ts
export function createMemoryStore(): MemoryStore;
```

### `createWebRepository`
```ts
export function createWebRepository(options?: {
    store?: UseStore;
    recentStorage?: Storage;
    now?: () => string;
}): ProjectRepository & {
    recents(): RecentProject[];
    removeRecent(path: string): void;
    listProjects(): Promise<RecentProject[]>;
};
```

### `MemoryProject`
```ts
export type MemoryProject = {
    projectId: string;
    copiedFromProjectId?: string;
    doc: unknown;
    rev: number;
    formatVersion: number;
    view: ViewState | null;
    journal: JournalEntry[];
    readOnly: boolean;
};
```

### `MemoryStore`
```ts
export type MemoryStore = {
    files: Map<string, MemoryProject>;
    locks: Map<string, string>;
    backups: Map<string, {
        info: BackupInfo;
        file: MemoryProject;
    }>;
    sequence: number;
};
```
