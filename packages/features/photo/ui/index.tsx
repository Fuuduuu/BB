import type { UiModule } from '@pcbk/ui';
import { PhotoLayer } from './PhotoLayer';
import { PhotoControls } from './PhotoControls';
import { photoEt } from './i18n/et';

export function createPhotoUi(): UiModule {
  return {
    id: 'photo',
    title: photoEt.title,
    bottomBar: [{ id: 'photo.controls', render: () => <PhotoControls /> }],
    canvasLayers: [{ id: 'photo.image', z: 0, render: (props) => <PhotoLayer {...props} /> }],
  };
}
