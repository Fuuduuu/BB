<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/ui

Sisenemispunkt: `packages/ui/src/shell-chrome.ts`

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

### `RecentProjectCard`
```ts
export type RecentProjectCard = RecentProject;
```

### `StartScreen`
```ts
export function StartScreen({ recent, availableProjects, openAvailable, onPickProjectFile, showBrowserStorage, busy, onPhotoFiles, onNew, onOpen, onRestore, onRemoveRecent, }: StartScreenProps): import("react").JSX.Element;
```

### `TopBar`
```ts
export function TopBar({ name, status, canUndo, canRedo, onUndo, onRedo, contextAvailable, children, }: HistoryActions & {
    name: string;
    status: Status;
    contextAvailable: boolean;
    children?: ReactNode;
}): import("react").JSX.Element;
```
