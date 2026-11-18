<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/ui

Sisenemispunkt: `packages/ui/src/shell-state.ts`

### `bindHistoryKeys`
```ts
export function bindHistoryKeys(target: Window, actions: HistoryActions): () => void;
```

### `ContextMenuItemSpec`
```ts
export interface ContextMenuItemSpec {
    id: string;
    appliesTo: string[];
    order: number;
    label(snapshot: Snapshot, selection: Selection): string;
    shortcut?: {
        key: string;
        shift?: boolean;
    };
    run(api: ToolApi, selection: Selection, at: Vec2): boolean;
}
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
        readonly contextEmpty: "Omadused · vali komponent või jalg";
        readonly showContext: "Näita omadusi";
        readonly hideContext: "Peida omadused";
        readonly resizeNavigator: "Navigaatori laius";
        readonly resizeContext: "Omaduste paneeli laius";
        readonly canvas: "Plaat";
        readonly contextMenu: "Toimingud";
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

### `PanelSpec`
```ts
export interface PanelSpec extends SlotSpec {
    title: string;
    summary?(snapshot: Snapshot): string | null;
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

### `SelectionKindSpec`
```ts
export interface SelectionKindSpec {
    kind: SelectionItem['kind'];
    label(snapshot: Snapshot, item: SelectionItem): string | null;
}
```

### `SHELL_KEYS`
```ts
export const SHELL_KEYS: {
    readonly cancel: {
        readonly key: "Escape";
        readonly shift: "any";
        readonly alt: "any";
    };
    readonly navigator: {
        readonly key: "N";
    };
    readonly context: {
        readonly key: "O";
    };
    readonly undo: {
        readonly key: "Z";
        readonly primary: true;
    };
    readonly redo: {
        readonly key: "Y";
        readonly primary: true;
    };
    readonly redoShift: {
        readonly key: "Z";
        readonly primary: true;
        readonly shift: true;
    };
    readonly select: {
        readonly key: "V";
    };
    readonly pan: {
        readonly key: "H";
    };
    readonly temporaryPan: {
        readonly key: " ";
        readonly shift: "any";
    };
    readonly contextMenu: {
        readonly key: "F10";
        readonly shift: true;
    };
    readonly contextMenuKey: {
        readonly key: "ContextMenu";
    };
    readonly nudgeLeft: {
        readonly key: "ArrowLeft";
        readonly shift: "any";
    };
    readonly nudgeRight: {
        readonly key: "ArrowRight";
        readonly shift: "any";
    };
    readonly nudgeUp: {
        readonly key: "ArrowUp";
        readonly shift: "any";
    };
    readonly nudgeDown: {
        readonly key: "ArrowDown";
        readonly shift: "any";
    };
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

### `Theme`
```ts
export type Theme = 'system' | 'light' | 'dark';
```

### `UiModule`
```ts
export interface UiModule {
    id: string;
    title: string;
    navigatorTabs?: PanelSpec[];
    contextSections?: ContextSectionSpec[];
    contextPinned?: PinnedSpec[];
    selectionKinds?: SelectionKindSpec[];
    topBar?: SlotSpec[];
    bottomBar?: SlotSpec[];
    canvasLayers?: LayerSpec[];
    tools?: ToolSpec[];
    keys?: KeySpec[];
    contextMenu?: ContextMenuItemSpec[];
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
    contextMenu(kind: string): ContextMenuItemSpec[];
    selectionLabel(snapshot: Snapshot, selection: Selection): string | null;
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
