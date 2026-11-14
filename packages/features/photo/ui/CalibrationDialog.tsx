import { useEffect, useRef, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { EngineError } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { Button, Dialog, Field, et, useSessionStore } from '@pcbk/ui';
import { useCalibrateStore } from './calibrate-store';
import { photoEt } from './i18n/et';
import './calibration-dialog.css';

const text = photoEt.calibration;

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

function CalibrationForm({ a, b }: { a: Vec2; b: Vec2 }) {
  const engine = useEngine();
  const error = useCalibrateStore((state) => state.error);
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  return (
    <Dialog open title={text.title} onClose={finish}>
      <form
        className="pcbk-calibration-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const mm = Number(input.trim().replace(',', '.'));
          if (!Number.isFinite(mm) || mm <= 0 || mm > 1000) {
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
        <p>{text.distance(Math.hypot(b.x - a.x, b.y - a.y))}</p>
        <Field
          ref={inputRef}
          label={text.mm}
          inputMode="decimal"
          value={input}
          error={invalid ? text.invalidMm : undefined}
          onChange={(event) => {
            setInput(event.currentTarget.value);
            setInvalid(false);
            useCalibrateStore.getState().setError(null);
          }}
        />
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
  const sessionId = useSnapshot((snapshot) => snapshot.sessionId);
  return dialogOpen && a && b ? <CalibrationForm key={sessionId} a={a} b={b} /> : null;
}
