<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/client

Sisenemispunkt: `packages/client/src/index.ts`

### `EngineProvider`
```ts
export function EngineProvider({ engine, projects, children }: PropsWithChildren<Services>): import("react").FunctionComponentElement<import("react").ProviderProps<Services | null>>;
```

### `useEngine`
```ts
export const useEngine: () => DocumentEngine;
```

### `useProjects`
```ts
export const useProjects: () => ProjectService;
```

### `useSaveStatus`
```ts
export function useSaveStatus(): SaveStatus;
```

### `useSnapshot`
```ts
export function useSnapshot<T>(select: (snapshot: Snapshot) => T): T;
```
