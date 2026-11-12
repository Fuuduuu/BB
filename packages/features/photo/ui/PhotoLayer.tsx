import { useProjects, useSaveStatus } from '@pcbk/client';
import type { LayerSpec } from '@pcbk/ui';

export function PhotoLayer({ snapshot }: Parameters<LayerSpec['render']>[0]) {
  const projects = useProjects();
  // A copy changes the storage handle without changing the document snapshot.
  useSaveStatus();
  const photo = snapshot.doc.photos.find((photo) => photo.id === snapshot.doc.activePhotoId);
  if (!photo) return null;
  const url = projects.photoUrl(photo.id, 'display');
  if (url === null) return null;
  return (
    <image
      data-layer="photo.image"
      href={url}
      x={0}
      y={0}
      width={photo.widthPx}
      height={photo.heightPx}
      preserveAspectRatio="none"
      style={{ imageOrientation: 'none' }}
      pointerEvents="none"
    />
  );
}
