<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/ui

Sisenemispunkt: `packages/ui/src/shell/index.ts`

### `AppShell`
```ts
export function AppShell(props: AppShellProps): import("react").JSX.Element;
```

### `AppShellProps`
```ts
export interface AppShellProps extends SaveRecoveryActions, RootRecoveryActions {
    registry?: UiRegistry;
    canvas?: ReactNode;
    manageTheme?: boolean;
}
```

### `bindHistoryKeys`
```ts
export function bindHistoryKeys(target: Window, actions: HistoryActions): () => void;
```

### `CloseDialog`
```ts
export function CloseDialog({ open, reason, opening, busy, copyAvailable, onCancel, onDiscard, onRetrySave, onSaveElsewhere, }: SaveRecoveryActions & {
    open: boolean;
    reason: StorageReason;
    opening?: boolean;
    busy?: boolean;
    onCancel(): void;
    onDiscard(): void;
}): import("react").JSX.Element;
```

### `ContextSectionSpec`
```ts
export interface ContextSectionSpec {
    id: string;
    order: number;
    appliesTo: string[];
    render(props: {
        selection: Selection;
    }): ReactNode;
}
```

### `ErrorBar`
```ts
export function ErrorBar({ reason, onRetrySave, onSaveElsewhere, copyAvailable, }: SaveRecoveryActions & {
    reason: StorageReason;
}): import("react").JSX.Element;
```

### `et`
```ts
export const et: {
    readonly reason: {
        disk_full: string;
        read_only: string;
        missing: string;
        locked: string;
        exists: string;
        not_project: string;
        too_new: string;
        unsupported_image: string;
        image_too_large: string;
        corrupt_image: string;
        stale_rev: string;
        unknown: string;
    };
    readonly appName: "PCB Kaardistaja";
    readonly brand: {
        readonly pcb: "PCB";
        readonly name: "Kaardistaja";
    };
    readonly common: {
        readonly close: "Sulge";
        readonly dismiss: "Peida teade";
        readonly retry: "Proovi uuesti";
        readonly saveElsewhere: "Salvesta mujale…";
        readonly cancel: "Katkesta";
        readonly actionFailed: "Muudatust ei saanud teha. Proovi uuesti.";
    };
    readonly shell: {
        readonly projectName: "Projekti nimi";
        readonly untitled: "Nimetu plaat";
        readonly navigator: "Navigaator";
        readonly showNavigator: "Näita navigaatorit";
        readonly hideNavigator: "Peida navigaator";
        readonly components: "Komponendid";
        readonly navigatorEmpty: "Siia ilmuvad plaadi komponendid.";
        readonly context: "Omadused";
        readonly contextEmpty: "Vali komponent, et näha selle omadusi.";
        readonly showContext: "Näita omadusi";
        readonly hideContext: "Peida omadused";
        readonly resizeNavigator: "Navigaatori laius";
        readonly resizeContext: "Omaduste paneeli laius";
        readonly canvas: "Plaat";
        readonly selectTool: "Vali";
        readonly panTool: "Liiguta vaadet";
        readonly canvasEmpty: "Sinu plaadi tööala";
        readonly canvasHint: "Komponendid ja ühendused kuvatakse siin.";
        readonly bottomBar: "Plaadi olek";
        readonly zoomOut: "Vähenda";
        readonly zoomIn: "Suurenda";
        readonly fit: "Sobita";
        readonly zoomPercent: (zoom: number) => string;
        readonly cursor: (point: {
            x: number;
            y: number;
        } | null) => string;
        readonly undo: "Võta tagasi";
        readonly redo: "Tee uuesti";
        readonly appearance: "Välimus";
        readonly themeSystem: "Süsteemi järgi";
        readonly themeLight: "Hele";
        readonly themeDark: "Tume";
    };
    readonly save: {
        readonly saving: "Salvestan…";
        readonly saved: (time: string) => string;
        readonly failed: (why: string) => string;
        readonly closeTitle: (why: string) => string;
        readonly discard: "Sulge salvestamata";
        readonly openDiscard: "Ava salvestamata";
        readonly discardHint: "Viimased muudatused kaovad";
    };
    readonly error: {
        readonly root: "Midagi läks valesti.";
        readonly panel: "Selle osa kuvamisel tekkis viga.";
        readonly copyReload: "Salvesta koopia ja lae uuesti";
        readonly diagnostics: "Salvesta diagnostika…";
    };
    readonly project: {
        readonly newBoard: "Uus plaat";
        readonly dropPhoto: "Lohista plaadi foto siia või kleebi Ctrl+V";
        readonly invalidPhotoDrop: "Lohista siia JPEG- või PNG-foto.";
        readonly photoFailed: (reason: string) => string;
        readonly open: "Ava fail…";
        readonly openTitle: "Ava projekt";
        readonly openNamed: (name: string) => string;
        readonly start: "Alusta";
        readonly name: "Nimi";
        readonly device: "Seade / mudel";
        readonly problem: "Mis on viga?";
        readonly recent: "Viimased projektid";
        readonly noRecent: "Alusta uue plaadiga. Sinu projektid ilmuvad siia.";
        readonly intro: "Sinu plaadi komponendid, ühendused ja remondimärkmed ühes kohas.";
        readonly browserStorage: "Selles brauseris salvestatakse projektid automaatselt. Kasuta taasavamiseks sama brauserit.";
        readonly restore: "Taasta varukoopiast…";
        readonly restoreUnavailable: "Varukoopiast taastamine on saadaval töölauarakenduses.";
        readonly restoreTitle: "Taasta varukoopiast";
        readonly restoreLoading: "Varukoopiaid laaditakse…";
        readonly restoreNone: "Selle projekti varukoopiaid ei leitud.";
        readonly restoreFailed: "Taastamine ebaõnnestus. Algne projekt on muutmata.";
        readonly restoreFull: "Täiskoopia";
        readonly restoreDoc: "Muudatuste koopia";
        readonly restoreConfirm: "Taasta";
        readonly restoreName: (name: string) => string;
        readonly copyUnavailable: "Koopia salvestamine on saadaval töölauarakenduses.";
        readonly rescueCopy: "Koopia tehti mälus olevast seisust, sest algset faili ei saanud lugeda. Fotod ja manused jäid algsesse faili.";
        readonly diagnosticsSaved: "Diagnostika salvestatud";
        readonly returnHome: "Tagasi avalehele";
        readonly closeProject: "Sulge projekt";
        readonly missing: "Faili ei leitud";
        readonly removeRecent: "Eemalda nimekirjast";
        readonly emptyOpen: "Selles brauseris ei ole veel projekte. Loo uus plaat.";
        readonly openFailed: "Projekti avamine ebaõnnestus.";
        readonly createFailed: "Projekti loomine ebaõnnestus.";
        readonly changedElsewhere: "Projekti muudeti teises aknas. Sinu muudatused on mälus alles.";
        readonly recentFailed: "Viimaste projektide loendit ei saanud salvestada. Projekt on alles.";
        readonly defaultName: (date: string) => string;
    };
};
```

### `HistoryActions`
```ts
export interface HistoryActions {
    canUndo: boolean;
    canRedo: boolean;
    onUndo(): void;
    onRedo(): void;
}
```

### `KeySpec`
```ts
export interface KeySpec {
    id: string;
    key: string;
    shift?: boolean;
    repeat?: boolean;
    run(api: ToolApi, selection: Selection): boolean;
}
```

### `NewBoardDialog`
```ts
export function NewBoardDialog({ open, busy, error, onClose, onCreate, }: NewBoardDialogProps): import("react").JSX.Element;
```

### `PanelErrorBoundary`
```ts
export function PanelErrorBoundary({ children }: PropsWithChildren): import("react").JSX.Element;
```

### `PanelSpec`
```ts
export interface PanelSpec extends SlotSpec {
    title: string;
    count?(snapshot: Snapshot): number;
}
```

### `PinnedSpec`
```ts
export interface PinnedSpec {
    id: string;
    order: number;
    useVisible(): boolean;
    render(): ReactNode;
}
```

### `Preview`
```ts
export type Preview = {
    owner: string;
    data: unknown;
};
```

### `RecentProjectCard`
```ts
export type RecentProjectCard = RecentProject;
```

### `RootErrorBoundary`
```ts
export function RootErrorBoundary({ children, onCopyAndReload, onExportDiagnostics, copyAvailable, }: PropsWithChildren<RootRecoveryActions>): import("react").JSX.Element;
```

### `RootRecoveryActions`
```ts
export interface RootRecoveryActions {
    copyAvailable?: boolean;
    onCopyAndReload(): void;
    onExportDiagnostics(): void;
}
```

### `SaveRecoveryActions`
```ts
export interface SaveRecoveryActions {
    copyAvailable?: boolean;
    onRetrySave(): void;
    onSaveElsewhere(): void;
}
```

### `SaveStatus`
```ts
export function SaveStatus({ status }: {
    status: Status;
}): import("react").JSX.Element | null;
```

### `Selection`
```ts
export type Selection = {
    items: SelectionItem[];
};
```

### `SelectionItem`
```ts
export type SelectionItem = {
    kind: string;
    id: string;
    componentId?: string;
};
```

### `SlotSpec`
```ts
export interface SlotSpec {
    id: string;
    order?: number;
    render(): ReactNode;
}
```

### `StartScreen`
```ts
export function StartScreen({ recent, availableProjects, openAvailable, onPickProjectFile, showBrowserStorage, busy, onPhotoFiles, onNew, onOpen, onRestore, onRemoveRecent, }: StartScreenProps): import("react").JSX.Element;
```

### `Theme`
```ts
export type Theme = 'system' | 'light' | 'dark';
```

### `TopBar`
```ts
export function TopBar({ name, status, canUndo, canRedo, onUndo, onRedo, children, }: HistoryActions & {
    name: string;
    status: Status;
    children?: ReactNode;
}): import("react").JSX.Element;
```

### `UiModule`
```ts
export interface UiModule {
    id: string;
    title: string;
    navigatorTabs?: PanelSpec[];
    contextSections?: ContextSectionSpec[];
    contextPinned?: PinnedSpec[];
    topBar?: SlotSpec[];
    bottomBar?: SlotSpec[];
    canvasLayers?: LayerSpec[];
    tools?: ToolSpec[];
    keys?: KeySpec[];
    onSessionReset?(): void;
}
```

### `UiRegistry`
```ts
export class UiRegistry {
    constructor(modules?: UiModule[]);
    register(module: UiModule): void;
    modules(): UiModule[];
    navigatorTabs(): PanelSpec[];
    contextSections(selection: Selection): ContextSectionSpec[];
    contextPinned(): PinnedSpec[];
    topBar(): SlotSpec[];
    bottomBar(): SlotSpec[];
    canvasLayers(): LayerSpec[];
    tools(): ToolSpec[];
    keys(): KeySpec[];
    resetSession(): void;
}
```

### `useSessionStore`
```ts
export const useSessionStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SessionStore>>;
```

### `useTheme`

Mount once at the active UI root so the preference also covers the start screen.

```ts
export function useTheme(enabled?: boolean): void;
```

### `useViewStore`
```ts
export const useViewStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ViewStore>>;
```
