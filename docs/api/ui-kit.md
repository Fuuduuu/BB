<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/ui

Sisenemispunkt: `packages/ui/src/kit/index.ts`

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

### `Panel`
```ts
export function Panel({ title, actions, children, className, ...props }: PanelProps): import("react").JSX.Element;
```

### `PanelProps`
```ts
export interface PanelProps extends HTMLAttributes<HTMLElement> {
    title: string;
    actions?: ReactNode;
}
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
