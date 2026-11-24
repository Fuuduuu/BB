import { useId } from 'react';
import { useSnapshot } from '@pcbk/client';
import type { Selection } from '@pcbk/ui';
import { contactFromSelection } from './contacts';
import { measureEt as text, measurementListText } from './i18n/et';
import { displayValue } from './measurement-display';
import './measurement-list.css';

export function PinMeasurements({ selection }: { selection: Selection }) {
  const snapshot = useSnapshot((current) => current);
  const headingId = useId();
  const selected = contactFromSelection(snapshot, selection);
  if (!selected) return null;

  const measurements = snapshot.doc.measurements
    .filter(({ at, ref }) => at.uid === selected.uid || ref?.uid === selected.uid)
    .reverse()
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));

  return (
    <section className="pcbk-pin-measurements" aria-labelledby={headingId}>
      <h3 id={headingId}>
        {text.pinMeasurements} ({measurements.length})
      </h3>
      {measurements.length ? (
        <ol className="pcbk-measurement-list" role="list">
          {measurements.slice(0, 5).map((measurement) => (
            <li className="pcbk-measurement-row bb-mono" key={measurement.id}>
              {measurement.mode !== 'voltage' &&
                `${measurementListText.modes[measurement.mode]} · `}
              {`${displayValue(measurement)} · ${measurement.atLabel}${
                measurement.refLabel ? ` → ${measurement.refLabel}` : ''
              }`}
            </li>
          ))}
        </ol>
      ) : (
        <p className="pcbk-empty-pane">{text.pinMeasurementsEmpty}</p>
      )}
    </section>
  );
}
