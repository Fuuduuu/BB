import type { UiModule } from '@pcbk/ui';
import { PhotoLayer } from './PhotoLayer';
import { PhotoControls } from './PhotoControls';
import { photoEt } from './i18n/et';
import { calibrateToolSpec } from './CalibrateTool';
import { CalibrationDialog } from './CalibrationDialog';
import { PHOTO_CALIBRATION_LAYER } from './CalibrationLayer';
import { useCalibrateStore } from './calibrate-store';
import { PhotoDropLayer } from './PhotoDropLayer';
import { resetPhotoImports } from './photo-import-store';
export { addPhoto } from './add-photo';

export function createPhotoUi(): UiModule {
  return {
    id: 'photo',
    title: photoEt.title,
    bottomBar: [
      {
        id: 'photo.controls',
        render: () => (
          <>
            <PhotoControls />
            <CalibrationDialog />
          </>
        ),
      },
    ],
    tools: [calibrateToolSpec()],
    canvasLayers: [
      { id: 'photo.image', z: 0, render: (props) => <PhotoLayer {...props} /> },
      { id: 'photo.drop', z: 1, render: () => <PhotoDropLayer /> },
      PHOTO_CALIBRATION_LAYER,
    ],
    onSessionReset: () => {
      useCalibrateStore.getState().reset();
      resetPhotoImports();
    },
  };
}
