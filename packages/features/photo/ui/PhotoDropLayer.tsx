import { useEffect, useRef } from 'react';
import { useEngine, useProjects } from '@pcbk/client';
import { pickPhotoFile } from '@pcbk/ui';
import { queuePhotoImport } from './photo-import-store';

export function PhotoDropLayer() {
  const marker = useRef<SVGGElement>(null);
  const engine = useEngine();
  const projects = useProjects();
  useEffect(() => {
    const svg = marker.current?.ownerSVGElement;
    if (!svg) return;
    const drag = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      queuePhotoImport(pickPhotoFile(event.dataTransfer?.files ?? []), { engine, projects });
    };
    svg.addEventListener('dragenter', drag);
    svg.addEventListener('dragover', drag);
    svg.addEventListener('drop', drop);
    return () => {
      svg.removeEventListener('dragenter', drag);
      svg.removeEventListener('dragover', drag);
      svg.removeEventListener('drop', drop);
    };
  }, [engine, projects]);
  return <g ref={marker} data-layer="photo.drop" pointerEvents="none" />;
}
