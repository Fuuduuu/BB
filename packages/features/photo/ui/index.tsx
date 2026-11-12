import type { UiModule } from '@pcbk/ui';
import { PhotoLayer } from './PhotoLayer';

export function createPhotoUi(): UiModule {
  return {
    id: 'photo',
    title: 'Foto',
    canvasLayers: [{ id: 'photo.image', z: 0, render: (props) => <PhotoLayer {...props} /> }],
  };
}
