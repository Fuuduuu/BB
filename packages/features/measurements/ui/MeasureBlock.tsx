import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { IdGen } from '@pcbk/contracts';
import type { MeasuredPin } from '@pcbk/domain';
import { formatReading, parseReading } from '@pcbk/domain/measure/reading';
import { Button, Field, useSessionStore } from '@pcbk/ui';
import { contactFromSelection, resolveContact } from './contacts';
import { commandError, measureEt as text } from './i18n/et';
import { displayValue } from './measurement-display';
import { pairKey, useMeasureStore } from './measure-store';
import type { MeasureMode, Power } from './measure-store';
import { ProbeRows } from './ProbeRows';
import './measure-block.css';

const nextPower: Record<Power, Power> = { unknown: 'on', on: 'off', off: 'unknown' };

type ReadingFields =
  | { mode: 'voltage'; value: number; ref?: MeasuredPin }
  | { mode: 'continuity'; beep: boolean; ref: MeasuredPin };

export function MeasureBlock({ ids, suggestions }: { ids: IdGen; suggestions: MeasuredPin[] }) {
  const engine = useEngine();
  const snapshot = useSnapshot((value) => value);
  const selection = useSessionStore((state) => state.selection);
  const { measureAt, blackProbe, mode, drafts, lastPower, focusTick, lastSavedId, ...actions } =
    useMeasureStore();
  const [error, setError] = useState<{ pair: string; message: string; invalid?: boolean }>();
  const input = useRef<HTMLInputElement>(null);
  const modeInput = useRef<HTMLSelectElement>(null);
  const beepButton = useRef<HTMLButtonElement>(null);
  const refUid = blackProbe?.uid;
  const prevFocus = useRef({ focusTick: 0, refUid });
  const id = useId();

  useLayoutEffect(() => {
    const requested = focusTick > 0 && focusTick !== prevFocus.current.focusTick;
    const pickedRef = refUid !== prevFocus.current.refUid && refUid !== undefined;
    prevFocus.current = { focusTick, refUid };
    if (mode === 'voltage') {
      if (requested) input.current?.focus();
    } else if ((requested || pickedRef) && beepButton.current && !beepButton.current.disabled) {
      beepButton.current.focus();
    } else if (requested) {
      modeInput.current?.focus();
    }
  }, [focusTick, mode, refUid]);

  if (!measureAt) return null;
  const at = measureAt;
  const atContact = resolveContact(snapshot, at);
  const refContact = blackProbe && resolveContact(snapshot, blackProbe);
  const missingRef = blackProbe !== null && !refContact;
  const blocked = !atContact || missingRef;
  const pair = pairKey(at, blackProbe);
  const draft = drafts[pair] ?? { text: '', power: lastPower };
  const activeError = error?.pair === pair ? error : undefined;
  const selectedPin = contactFromSelection(snapshot, selection);
  const reading = selectedPin && snapshot.derived.pinReadings[selectedPin.uid];
  const readingMeasurement =
    reading && snapshot.doc.measurements.find(({ id }) => id === reading.measurementId);
  const saved = snapshot.doc.measurements.find(({ id }) => id === lastSavedId);
  const lastSaved =
    saved?.mode === 'continuity' || (saved?.mode === 'voltage' && saved.value !== undefined)
      ? {
          mode: saved.mode,
          value: displayValue(saved),
          pair: `${saved.atLabel}${saved.refLabel ? ` → ${saved.refLabel}` : ''}`,
        }
      : undefined;

  function editDraft(change: Partial<typeof draft>) {
    actions.setDraft(pair, { ...draft, ...change });
    setError(undefined);
  }

  function save(reading: ReadingFields) {
    const measurementId = ids.newId('msr');
    const result = engine.execute('measurements.add', {
      ...reading,
      id: measurementId,
      at,
      power: draft.power,
      takenAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setError({ pair, message: commandError(result.error) });
      return;
    }
    actions.setLastSaved(measurementId, draft.power);
    setError(undefined);
    if (reading.mode === 'voltage') {
      actions.clearDraft(pair);
      input.current?.focus();
    }
  }

  function saveVoltage() {
    if (blocked) return;
    const reading = parseReading(draft.text, 'voltage');
    if (!reading) {
      const message = draft.text.trim() === '' ? text.emptyVoltage : text.invalidVoltage;
      setError({ pair, message, invalid: true });
      return;
    }
    save({ mode: 'voltage', value: reading.value, ...(blackProbe && { ref: blackProbe }) });
  }

  function saveContinuity(beep: boolean) {
    if (blocked || !blackProbe) return;
    save({ mode: 'continuity', beep, ref: blackProbe });
  }

  function changeMode(next: MeasureMode) {
    actions.setMode(next);
    setError(undefined);
  }

  function step(delta: number) {
    if (!atContact) return;
    const { component, pin } = atContact;
    const next = component.pins[component.pins.indexOf(pin) + delta];
    if (!next) return;
    actions.setMeasureAt({ c: component.id, p: next.id, uid: next.uid });
    useSessionStore.getState().setSelection({
      items: [{ kind: 'pin', id: next.id, componentId: component.id }],
    });
  }

  function onValueKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) return;
    if (event.altKey) {
      if (event.key === 'ArrowDown') step(1);
      else if (event.key === 'ArrowUp') step(-1);
      else if (event.key.toLowerCase() === 'p') editDraft({ power: nextPower[draft.power] });
      else return;
    } else if (event.key === 'Enter') {
      saveVoltage();
    } else if (event.key === 'Escape') {
      actions.clearDraft(pair);
      setError(undefined);
      event.currentTarget.blur();
    } else {
      return;
    }
    event.preventDefault();
  }

  function onBlockKey(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (event.altKey && (key === '1' || key === '4')) {
      changeMode(key === '1' ? 'voltage' : 'continuity');
      actions.requestFocus();
    } else if (mode === 'continuity' && event.altKey && key === 'n') {
      if (!event.repeat) saveContinuity(false);
    } else if (
      mode === 'continuity' &&
      !event.altKey &&
      key === 'enter' &&
      event.target === beepButton.current
    ) {
      if (!event.repeat) saveContinuity(true);
    } else {
      return;
    }
    event.preventDefault();
  }

  return (
    <section
      className="pcbk-measure-block"
      aria-labelledby={`${id}-heading`}
      onKeyDown={onBlockKey}
    >
      <h2 id={`${id}-heading`}>{text.title}</h2>
      <div className="bb-field">
        <label className="bb-field__label" htmlFor={`${id}-mode`}>
          {text.mode}
        </label>
        <select
          ref={modeInput}
          className="bb-input"
          id={`${id}-mode`}
          aria-describedby={`${id}-mode-keys`}
          aria-keyshortcuts="Alt+1 Alt+4"
          value={mode}
          onChange={(event) => changeMode(event.currentTarget.value as MeasureMode)}
        >
          {Object.entries(text.modes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="pcbk-measure-keys" id={`${id}-mode-keys`}>
          {text.modeKeys}
        </p>
      </div>
      {reading && readingMeasurement && (
        <p className="pcbk-board-reading">
          {text.boardReading(
            formatReading(reading, reading.mode),
            readingMeasurement.refLabel || text.unset,
            text.powerLabels[readingMeasurement.power],
          )}
        </p>
      )}
      <ProbeRows snapshot={snapshot} at={at} blackProbe={blackProbe} suggestions={suggestions} />
      {blocked && (
        <div className="bb-field bb-field__error" id={`${id}-deleted`} role="alert">
          {!atContact && <span>{text.missingAt}</span>}
          {missingRef && <span>{text.missingRef}</span>}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === 'voltage') saveVoltage();
          else saveContinuity(true);
        }}
      >
        <div className="bb-field">
          <label className="bb-field__label" htmlFor={`${id}-power`}>
            {text.power}
          </label>
          <select
            className="bb-input"
            id={`${id}-power`}
            value={draft.power}
            onChange={(event) => editDraft({ power: event.currentTarget.value as Power })}
          >
            {Object.entries(text.powerLabels).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {mode === 'voltage' && (
          <Field
            ref={input}
            label={text.voltage}
            className="pcbk-measure-value"
            hint={lastSaved?.mode === 'voltage' ? undefined : text.hint}
            error={activeError?.invalid ? activeError.message : undefined}
            aria-describedby={blocked ? `${id}-deleted` : undefined}
            value={draft.text}
            onChange={(event) => editDraft({ text: event.currentTarget.value })}
            onKeyDown={onValueKey}
          />
        )}
        <div className="pcbk-last-saved-live" aria-live="polite" aria-atomic="true">
          {lastSaved && (
            <div className="pcbk-last-saved" key={lastSavedId}>
              <span className="pcbk-last-saved__title">{text.lastSaved}</span>
              {lastSaved.mode === 'continuity' ? (
                <div className="pcbk-last-saved__value">
                  {text.modes.continuity} · {lastSaved.value} · {lastSaved.pair}
                </div>
              ) : (
                <div className="pcbk-last-saved__row">
                  <span className="pcbk-last-saved__value">{lastSaved.value}</span>
                  <span className="pcbk-last-saved__pair">{lastSaved.pair}</span>
                </div>
              )}
            </div>
          )}
        </div>
        {activeError && !activeError.invalid && (
          <p className="bb-field__error" role="alert">
            {activeError.message}
          </p>
        )}
        {mode === 'continuity' ? (
          <>
            <div className="pcbk-measure-actions">
              <Button
                ref={beepButton}
                type="submit"
                variant="primary"
                aria-keyshortcuts="Enter"
                disabled={blocked || !blackProbe}
              >
                {text.beeps}
              </Button>
              <Button
                aria-keyshortcuts="Alt+N"
                disabled={blocked || !blackProbe}
                onClick={() => saveContinuity(false)}
              >
                {text.noBeep}
              </Button>
            </div>
            {!refContact && <p className="pcbk-measure-keys">{text.needRef}</p>}
            <p className="pcbk-measure-keys">{text.beepKeys}</p>
          </>
        ) : (
          <>
            <Button type="submit" variant="primary" disabled={blocked}>
              {text.save}
            </Button>
            {atContact && atContact.component.pins.length > 1 && (
              <p className="pcbk-measure-keys">{text.pinKeys}</p>
            )}
          </>
        )}
      </form>
    </section>
  );
}
