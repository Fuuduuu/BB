export type SurfaceSource = {
  readonly photos: readonly {
    readonly id: string;
    readonly widthPx: number;
    readonly heightPx: number;
  }[];
  readonly activePhotoId?: string | undefined;
};

export function boardSurface(doc: SurfaceSource): { width: number; height: number } {
  const photo = doc.photos.find((photo) => photo.id === doc.activePhotoId);
  return photo ? { width: photo.widthPx, height: photo.heightPx } : { width: 2000, height: 1400 };
}
