<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/domain/constants

Sisenemispunkt: `packages/domain/src/constants.ts`

### `BACKUP_KEEP`
```ts
export const BACKUP_KEEP: 5;
```

### `CURRENT_FORMAT_VERSION`
```ts
export const CURRENT_FORMAT_VERSION: 1;
```

### `DEFAULT_ROLES`
```ts
export const DEFAULT_ROLES: readonly [
    {
        readonly id: "rol_gnd";
        readonly label: "GND";
        readonly kind: "ground";
        readonly nominalV: 0;
        readonly color: "#1f2523";
    },
    {
        readonly id: "rol_3v3";
        readonly label: "3V3";
        readonly kind: "power";
        readonly nominalV: 3.3;
        readonly color: "#e8891c";
    },
    {
        readonly id: "rol_5v";
        readonly label: "5V";
        readonly kind: "power";
        readonly nominalV: 5;
        readonly color: "#d9342b";
    },
    {
        readonly id: "rol_12v";
        readonly label: "12V";
        readonly kind: "power";
        readonly nominalV: 12;
        readonly color: "#2a64d6";
    },
    {
        readonly id: "rol_sig";
        readonly label: "Signaal";
        readonly kind: "signal";
        readonly color: "#8a4fd3";
    },
    {
        readonly id: "rol_unk";
        readonly label: "Teadmata";
        readonly kind: "unknown";
        readonly color: "#8c9692";
    }
];
```

### `DOC_BACKUP_INTERVAL_MS`
```ts
export const DOC_BACKUP_INTERVAL_MS: 1800000;
```

### `HISTORY_LIMIT`
```ts
export const HISTORY_LIMIT: 200;
```

### `SAVE_DEBOUNCE_MS`
```ts
export const SAVE_DEBOUNCE_MS: 1500;
```

### `SAVE_MAX_WAIT_MS`
```ts
export const SAVE_MAX_WAIT_MS: 10000;
```
