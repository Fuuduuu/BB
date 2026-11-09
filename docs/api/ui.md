<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/ui

Sisenemispunkt: `packages/ui/src/index.ts`

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

### `Button`
```ts
export const Button: import("react").ForwardRefExoticComponent<ButtonProps & import("react").RefAttributes<HTMLButtonElement>>;
```

### `ButtonProps`
```ts
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    busy?: boolean;
}
```

### `CloseDialog`
```ts
export function CloseDialog({ open, reason, busy, copyAvailable, onCancel, onDiscard, onRetrySave, onSaveElsewhere, }: SaveRecoveryActions & {
    open: boolean;
    reason: StorageReason;
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
    appliesTo: SelectionKind[];
    render(props: {
        selection: Selection;
    }): ReactNode;
}
```

### `Dialog`
```ts
export function Dialog({ open, title, onClose, closeLabel, closeDisabled, children, className, }: DialogProps): import("react").JSX.Element;
```

### `DialogProps`
```ts
export type DialogProps = PropsWithChildren<{
    open: boolean;
    title: string;
    onClose: () => void;
    closeLabel?: string;
    closeDisabled?: boolean;
    className?: string;
}>;
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
        not_project: string;
        too_new: string;
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
    };
    readonly shell: {
        readonly projectName: "Projekti nimi";
        readonly untitled: "Nimetu plaat";
        readonly navigator: "Navigaator";
        readonly components: "Komponendid";
        readonly navigatorEmpty: "Siia ilmuvad plaadi komponendid.";
        readonly context: "Omadused";
        readonly contextEmpty: "Vali komponent, et näha selle omadusi.";
        readonly showContext: "Näita omadusi";
        readonly hideContext: "Peida omadused";
        readonly resizeNavigator: "Navigaatori laius";
        readonly resizeContext: "Omaduste paneeli laius";
        readonly canvas: "Plaat";
        readonly canvasEmpty: "Sinu plaadi tööala";
        readonly canvasHint: "Komponendid ja ühendused kuvatakse siin.";
        readonly bottomBar: "Plaadi olek";
        readonly ready: "Valmis";
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
        readonly copyUnavailable: "Koopia salvestamine on saadaval töölauarakenduses.";
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
    readonly component: {
        readonly title: "Komponendid";
        readonly add: "Lisa komponent";
        readonly addTitle: "Lisa komponent";
        readonly type: "Tüüp";
        readonly pinCount: "Jalgade arv";
        readonly ref: "Tähis";
        readonly marking: "Korpuse märgistus";
        readonly value: "Väärtus või mudel";
        readonly note: "Märkused";
        readonly identified: "Tuvastatud";
        readonly dnp: "DNP";
        readonly pins: "Jalad";
        readonly pinId: "Jalg";
        readonly pinName: "Nimi";
        readonly nc: "NC";
        readonly addPin: "Lisa jalg";
        readonly remove: "Eemalda";
        readonly noPins: "Jalgu pole veel lisatud.";
        readonly empty: "Lisa esimene komponent, et alustada plaadi kirjeldamist.";
        readonly unplaced: "Plaadile paigutamata";
        readonly select: (ref: string) => string;
        readonly removePin: (id: string) => string;
        readonly namePin: (id: string) => string;
        readonly ncPin: (id: string) => string;
        readonly invalid: "Kontrolli sisestatud väärtust.";
        readonly duplicateRef: "See tähis on juba kasutusel.";
        readonly missing: "Komponenti või jalga ei leitud (võib-olla kustutati).";
        readonly readOnly: "Projekt on kirjutuskaitstud.";
        readonly failed: "Muudatust ei saanud teha. Proovi uuesti.";
        readonly valueHint: "nt väärtus või mudeli nimi";
        readonly resistorHint: "nt 10 kΩ";
        readonly markingHint: "nt 103 või A7W";
        readonly pinCountInvalid: "Sisesta sobiv täisarv.";
        readonly kinds: {
            resistor: string;
            capacitor: string;
            capacitor_polarized: string;
            inductor: string;
            diode: string;
            led: string;
            zener: string;
            npn: string;
            pnp: string;
            nmos: string;
            pmos: string;
            regulator: string;
            ic: string;
            connector: string;
            crystal: string;
            switch: string;
            fuse: string;
            testpoint: string;
            via: string;
            pad: string;
            wire_point: string;
            hole: string;
            other: string;
        };
    };
};
```

### `Field`
```ts
export const Field: import("react").ForwardRefExoticComponent<FieldProps & import("react").RefAttributes<HTMLInputElement>>;
```

### `FieldProps`
```ts
export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    hint?: string;
    error?: string;
}
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

### `NewBoardDialog`
```ts
export function NewBoardDialog({ open, busy, error, onClose, onCreate, }: NewBoardDialogProps): import("react").JSX.Element;
```

### `Panel`
```ts
export function Panel({ title, actions, children, className, ...props }: PanelProps): import("react").JSX.Element;
```

### `PanelErrorBoundary`
```ts
export function PanelErrorBoundary({ children }: PropsWithChildren): import("react").JSX.Element;
```

### `PanelProps`
```ts
export interface PanelProps extends HTMLAttributes<HTMLElement> {
    title: string;
    actions?: ReactNode;
}
```

### `PanelSpec`
```ts
export interface PanelSpec extends SlotSpec {
    title: string;
}
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
    kind: 'none';
} | {
    kind: 'component';
    id: string;
} | {
    kind: 'pin';
    componentId: string;
    pinId: string;
} | {
    kind: 'connection' | 'net' | 'measurement';
    id: string;
};
```

### `SelectionKind`
```ts
export type SelectionKind = Selection['kind'];
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
export function StartScreen({ recent, availableProjects, openAvailable, onPickProjectFile, showBrowserStorage, onNew, onOpen, onRemoveRecent, }: StartScreenProps): import("react").JSX.Element;
```

### `Theme`
```ts
export type Theme = 'system' | 'light' | 'dark';
```

### `Toast`
```ts
export function Toast({ items, onDismiss }: ToastProps): import("react").JSX.Element;
```

### `ToastItem`
```ts
export interface ToastItem {
    id: string;
    message: string;
    tone?: 'info' | 'success' | 'error';
}
```

### `ToastProps`
```ts
export interface ToastProps {
    items: readonly ToastItem[];
    onDismiss: (id: string) => void;
}
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
    topBar?: SlotSpec[];
    bottomBar?: SlotSpec[];
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
    topBar(): SlotSpec[];
    bottomBar(): SlotSpec[];
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

### `Workbench`
```ts
export function Workbench({ host, uiModules, }: {
    host: AppHost;
    uiModules: (onHome: () => void) => UiModule[];
}): import("react").JSX.Element;
```
