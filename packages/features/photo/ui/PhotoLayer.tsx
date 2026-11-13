import { useProjects, useSaveStatus } from '@pcbk/client';
import { useViewStore } from '@pcbk/ui';
import type { LayerSpec } from '@pcbk/ui';
import { readPhotoView } from './photo-view';

export function PhotoLayer({ snapshot }: Parameters<LayerSpec['render']>[0]) {
  const projects = useProjects();
  // A copy changes the storage handle without changing the document snapshot.
  useSaveStatus();
  const view = readPhotoView(useViewStore((store) => store.modules.photo));
  const photo = snapshot.doc.photos.find((photo) => photo.id === snapshot.doc.activePhotoId);
  if (!photo || !view.visible) return null;
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
      style={{
        imageOrientation: 'none',
        opacity: view.opacity,
        filter: `contrast(${view.contrast}) grayscale(${view.gray ? 1 : 0})`,
      }}
      pointerEvents="none"
    />
  );
}
