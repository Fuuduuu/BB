import { useMemo, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { Measurement } from '@pcbk/domain';
import { formatReading } from '@pcbk/domain/measure/reading';
import { Button } from '@pcbk/ui';
import { resolveContact } from './contacts';
import { commandError, measureEt, measurementListText } from './i18n/et';
import './measurement-list.css';

const localTime = new Intl.DateTimeFormat('et', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function displayValue({ mode, overload, value }: Measurement): string {
  if (overload) return measurementListText.overload;
  if (mode === 'voltage' && value !== undefined) return formatReading({ value }, mode);
  return measurementListText.unavailable;
}

export function MeasurementList() {
  const engine = useEngine();
  const snapshot = useSnapshot((current) => current);
  const { measurements } = snapshot.doc;
  const sorted = useMemo(
    () => [...measurements].sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt)),
    [measurements],
  );
  const [error, setError] = useState<string>();

  if (sorted.length === 0) return <p className="pcbk-empty-pane">{measurementListText.empty}</p>;

  return (
    <>
      {error && (
        <p className="bb-field__error" role="alert">
          {error}
        </p>
      )}
      <ol className="pcbk-measurement-list" role="list">
        {sorted.map((measurement) => {
          const { id, at, atLabel, ref, refLabel, mode, power, takenAt } = measurement;
          const removed = !resolveContact(snapshot, at) || (ref && !resolveContact(snapshot, ref));
          return (
            <li className="pcbk-measurement-row" key={id}>
              <div className="pcbk-measurement-row__details">
                {mode !== 'voltage' && <span>{measurementListText.modes[mode]}</span>}
                <div className="pcbk-measurement-row__contacts bb-mono">
                  <span>{atLabel}</span>
                  {refLabel && <span>→ {refLabel}</span>}
                </div>
                <div className="pcbk-measurement-row__metadata">
                  <strong className="bb-mono">{displayValue(measurement)}</strong>
                  <span>{measureEt.powerLabels[power]}</span>
                  <time className="bb-mono" dateTime={takenAt}>
                    {localTime.format(new Date(takenAt))}
                  </time>
                </div>
                {removed && <span>{measurementListText.removedContact}</span>}
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  const result = engine.execute('measurements.remove', { id });
                  setError(result.ok ? undefined : commandError(result.error));
                }}
              >
                {measurementListText.remove}
              </Button>
            </li>
          );
        })}
      </ol>
    </>
  );
}
