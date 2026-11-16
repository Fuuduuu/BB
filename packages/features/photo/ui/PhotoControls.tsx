import { useRef, useState } from 'react';
import { useEngine, useProjects, useSnapshot } from '@pcbk/client';
import { Button, pickPhotoFile, useSessionStore, useViewStore } from '@pcbk/ui';
import { mirrorHorizontal, rotateClockwise } from '../transform';
import { photoEt as text } from './i18n/et';
import { readPhotoView } from './photo-view';
import type { PhotoView } from './photo-view';
import { PhotoSettingsMenu } from './PhotoSettingsMenu';
import { CALIBRATE_TOOL_ID } from './CalibrateTool';
import { queuePhotoImport, usePhotoImportStore } from './photo-import-store';
import './photo-controls.css';

export function PhotoControls() {
  const engine = useEngine();
  const projects = useProjects();
  const { doc, sessionId } = useSnapshot((snapshot) => snapshot);
  const rawView = useViewStore((store) => store.modules.photo);
  const view = readPhotoView(rawView);
  const [error, setError] = useState<{ sessionId: string; message: string }>();
  const photo = doc.photos.find(({ id }) => id === doc.activePhotoId);
  const input = useRef<HTMLInputElement>(null);
  const feedback = usePhotoImportStore();
  const importing = feedback.sessionId === sessionId && feedback.busy;

  function changeView(change: Partial<PhotoView>) {
    useViewStore.getState().setModuleView('photo', { ...view, ...change });
  }

  function transform(operation: typeof rotateClockwise) {
    if (!photo) return;
    const result = engine.execute('photo.setTransform', {
      id: photo.id,
      transform: operation(photo.transform),
    });
    setError(
      result.ok
        ? undefined
        : {
            sessionId,
            message: result.error.code === 'read_only' ? text.readOnly : text.transformFailed,
          },
    );
  }

  return (
    <div className="pcbk-photo-controls" role="group" aria-label={text.title}>
      {doc.photos.length === 0 && (
        <>
          <Button variant="ghost" disabled={importing} onClick={() => input.current?.click()}>
            {text.add}
          </Button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png"
            hidden
            disabled={importing}
            onChange={(event) => {
              if (event.currentTarget.files?.length) {
                queuePhotoImport(pickPhotoFile(event.currentTarget.files), { engine, projects });
              }
              event.currentTarget.value = '';
            }}
          />
        </>
      )}
      {photo && (
        <>
          <Button
            variant="ghost"
            aria-pressed={!view.visible}
            onClick={() => changeView({ visible: !view.visible })}
          >
            {view.visible ? text.hide : text.show}
          </Button>
          <PhotoSettingsMenu
            key={`${sessionId}:${photo.id}`}
            view={view}
            onViewChange={changeView}
            onRotate={() => transform(rotateClockwise)}
            onMirror={() => transform(mirrorHorizontal)}
          />
        </>
      )}
      <Button
        variant="ghost"
        className="pcbk-photo-scale"
        aria-label={text.calibration.shortcut}
        onClick={() => useSessionStore.getState().setToolId(CALIBRATE_TOOL_ID)}
      >
        {doc.scale.calibrated === false ? text.uncalibrated : text.scale(doc.scale.pxPerMm)}
      </Button>
      {error?.sessionId === sessionId && <span role="alert">{error.message}</span>}
      {feedback.sessionId === sessionId && feedback.error && (
        <span role="alert">{feedback.error}</span>
      )}
    </div>
  );
}
