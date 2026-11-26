import { useEffect, useRef, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { EngineError } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { Button, Dialog, Field, et, useSessionStore } from '@pcbk/ui';
import { useCalibrateStore } from './calibrate-store';
import {
  calibrationPreview,
  formatCalibrationDimension,
  parseCalibrationMm,
} from './calibration-preview';
import type { CalibrationPhoto } from './calibration-preview';
import { photoEt } from './i18n/et';
import './calibration-dialog.css';

const text = photoEt.calibration;
const quickChoices = ['2,54', '10,16', '25,4', '10', '50', '100'];

function commandError(error: EngineError): string {
  if (error.code === 'validation') {
    if (error.issues.some((issue) => issue.message === 'calibration_too_short')) {
      return text.tooShort;
    }
    if (error.issues.some((issue) => issue.message === 'calibration_out_of_range')) {
      return text.outOfRange;
    }
  }
  if (error.code === 'read_only') return photoEt.readOnly;
  if (error.code === 'internal') return text.internal;
  return et.common.actionFailed;
}

function finish() {
  useCalibrateStore.getState().reset();
  useSessionStore.getState().setToolId('select');
}

function CalibrationForm({
  a,
  b,
  photo,
}: {
  a: Vec2;
  b: Vec2;
  photo: CalibrationPhoto | undefined;
}) {
  const engine = useEngine();
  const error = useCalibrateStore((state) => state.error);
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const distancePx = Math.hypot(b.x - a.x, b.y - a.y);
  const preview = calibrationPreview({ distancePx, input, photo });

  function changeInput(value: string) {
    setInput(value);
    setInvalid(false);
    useCalibrateStore.getState().setError(null);
  }

  return (
    <Dialog open title={text.title} onClose={finish}>
      <form
        className="pcbk-calibration-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const mm = parseCalibrationMm(input);
          if (mm === null) {
            setInvalid(true);
            return;
          }
          const result = engine.execute('photo.setScale', { a, b, mm });
          if (!result.ok) {
            useCalibrateStore.getState().setError(commandError(result.error));
            return;
          }
          finish();
        }}
      >
        <p>{text.distance(distancePx)}</p>
        <div className="pcbk-calibration-input">
          <Field
            ref={inputRef}
            label={text.mm}
            inputMode="decimal"
            value={input}
            error={invalid ? text.invalidMm : undefined}
            onChange={(event) => changeInput(event.currentTarget.value)}
          />
          <div className="pcbk-calibration-quick" role="group" aria-label={text.quick}>
            {quickChoices.map((value) => (
              <Button
                key={value}
                variant="ghost"
                aria-label={text.quickLabel(value)}
                onClick={() => {
                  changeInput(value);
                  inputRef.current?.focus();
                }}
              >
                {value}
              </Button>
            ))}
          </div>
          <output className="pcbk-calibration-preview" aria-live="polite">
            {preview && (
              <>
                <span>
                  {text.preview(
                    preview.pxPerMm.toFixed(2).replace('.', ','),
                    formatCalibrationDimension(preview.umPerPx),
                  )}
                </span>
                {preview.photoMm && (
                  <span>
                    {text.photoSize(
                      formatCalibrationDimension(preview.photoMm.width),
                      formatCalibrationDimension(preview.photoMm.height),
                    )}
                  </span>
                )}
              </>
            )}
          </output>
        </div>
        {error && (
          <p role="alert" className="bb-field__error">
            {error}
          </p>
        )}
        <div className="pcbk-calibration-actions">
          <Button onClick={finish}>{text.cancel}</Button>
          <Button type="submit" variant="primary">
            {text.confirm}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function CalibrationDialog() {
  const { a, b, dialogOpen } = useCalibrateStore();
  const { doc, sessionId } = useSnapshot((snapshot) => snapshot);
  if (!dialogOpen || !a || !b) return null;
  const photo = doc.photos.find(({ id }) => id === doc.activePhotoId);
  return <CalibrationForm key={sessionId} a={a} b={b} photo={photo} />;
}
