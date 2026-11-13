import { useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import { Button, useViewStore } from '@pcbk/ui';
import { mirrorHorizontal, rotateClockwise } from '../transform';
import { photoEt as text } from './i18n/et';
import { readPhotoView } from './photo-view';
import type { PhotoView } from './photo-view';
import './photo-controls.css';

export function PhotoControls() {
  const engine = useEngine();
  const { doc, sessionId } = useSnapshot((snapshot) => snapshot);
  const rawView = useViewStore((store) => store.modules.photo);
  const view = readPhotoView(rawView);
  const [error, setError] = useState<{ sessionId: string; message: string }>();
  const photo = doc.photos.find(({ id }) => id === doc.activePhotoId);

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
      {photo && (
        <>
          <Button
            variant="ghost"
            aria-pressed={!view.visible}
            onClick={() => changeView({ visible: !view.visible })}
          >
            {view.visible ? text.hide : text.show}
          </Button>
          <label className="pcbk-photo-range">
            <span>{text.opacity}</span>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={Math.round(view.opacity * 100)}
              aria-label={text.opacity}
              aria-valuetext={text.percent(view.opacity)}
              onChange={(event) => changeView({ opacity: Number(event.currentTarget.value) / 100 })}
            />
            <span>{text.percent(view.opacity)}</span>
          </label>
          <label className="pcbk-photo-range">
            <span>{text.contrast}</span>
            <input
              type="range"
              min={50}
              max={200}
              step={1}
              value={Math.round(view.contrast * 100)}
              aria-label={text.contrast}
              aria-valuetext={text.percent(view.contrast)}
              onChange={(event) =>
                changeView({ contrast: Number(event.currentTarget.value) / 100 })
              }
            />
            <span>{text.percent(view.contrast)}</span>
          </label>
          <Button
            variant="ghost"
            aria-pressed={view.gray}
            onClick={() => changeView({ gray: !view.gray })}
          >
            {text.gray}
          </Button>
          <Button variant="ghost" onClick={() => transform(rotateClockwise)}>
            {text.rotate}
          </Button>
          <Button variant="ghost" onClick={() => transform(mirrorHorizontal)}>
            {text.mirror}
          </Button>
        </>
      )}
      <span className="pcbk-photo-scale">
        {doc.scale.calibrated === false ? text.uncalibrated : text.scale(doc.scale.pxPerMm)}
      </span>
      {error?.sessionId === sessionId && <span role="alert">{error.message}</span>}
    </div>
  );
}
