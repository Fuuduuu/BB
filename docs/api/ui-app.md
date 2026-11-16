<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->

# @pcbk/ui

Sisenemispunkt: `packages/ui/src/app/index.ts`

### `pickPhotoFile`

Select a supported photo, or pass an unsupported image on to the decoder for its reason.

```ts
export function pickPhotoFile(files: Iterable<File> | ArrayLike<File>): File | null;
```

### `Workbench`
```ts
export function Workbench({ host, uiModules, validateModules, addPhoto, }: {
    host: AppHost;
    addPhoto?: (file: File) => Promise<Result<void, EngineError>>;
    uiModules: (onHome: () => void) => UiModule[];
    validateModules?: (modules: readonly UiModule[]) => void;
}): import("react").JSX.Element;
```
