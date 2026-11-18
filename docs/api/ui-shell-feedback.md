<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/ui

Sisenemispunkt: `packages/ui/src/shell-feedback.ts`

### `CloseDialog`
```ts
export function CloseDialog({ open, reason, copyError, opening, busy, copyAvailable, onCancel, onDiscard, onRetrySave, onSaveElsewhere, }: SaveRecoveryActions & {
    open: boolean;
    reason: StorageReason;
    copyError?: StorageReason;
    opening?: boolean;
    busy?: boolean;
    onCancel(): void;
    onDiscard(): void;
}): import("react").JSX.Element;
```

### `ErrorBar`
```ts
export function ErrorBar({ reason, onRetrySave, onSaveElsewhere, copyAvailable, }: SaveRecoveryActions & {
    reason: StorageReason;
}): import("react").JSX.Element;
```

### `PanelErrorBoundary`
```ts
export function PanelErrorBoundary({ children }: PropsWithChildren): import("react").JSX.Element;
```

### `RootErrorBoundary`
```ts
export function RootErrorBoundary({ children, onCopyAndReload, onPickCopyAndReload, onExportDiagnostics, copyAvailable, }: PropsWithChildren<RootRecoveryActions>): import("react").JSX.Element;
```

### `RootRecoveryActions`
```ts
export interface RootRecoveryActions {
    copyAvailable?: boolean;
    onCopyAndReload(): void;
    onPickCopyAndReload?(): void;
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
