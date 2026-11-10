import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { IdGen } from '@pcbk/contracts';
import type { MeasuredPin } from '@pcbk/domain';
import { parseReading } from '@pcbk/domain/measure/reading';
import { Button, Field, useSessionStore } from '@pcbk/ui';
import { resolveContact } from './contacts';
import { commandError, measureEt as text } from './i18n/et';
import { pairKey, useMeasureStore } from './measure-store';
import type { Power } from './measure-store';
import { PICK_REF_TOOL_ID } from './PickRefTool';
import './measure-block.css';

const nextPower: Record<Power, Power> = { unknown: 'on', on: 'off', off: 'unknown' };

function label(contact: NonNullable<ReturnType<typeof resolveContact>>): string {
  return `${contact.component.ref}.${contact.pin.id}`;
}

export function MeasureBlock({ ids, suggestions }: { ids: IdGen; suggestions: MeasuredPin[] }) {
  const engine = useEngine();
  const snapshot = useSnapshot((value) => value);
  const { measureAt, blackProbe, drafts, lastPower, focusTick, ...actions } = useMeasureStore();
  const [error, setError] = useState<{ pair: string; message: string; invalid?: boolean }>();
  const input = useRef<HTMLInputElement>(null);
  const handledFocusTick = useRef(0);
  const id = useId();

  useLayoutEffect(() => {
    if (focusTick > 0 && focusTick !== handledFocusTick.current) input.current?.focus();
    handledFocusTick.current = focusTick;
  }, [focusTick]);

  if (!measureAt) return null;
  const at = measureAt;
  const atContact = resolveContact(snapshot, at);
  const refContact = blackProbe && resolveContact(snapshot, blackProbe);
  const missingRef = blackProbe !== null && !refContact;
  const blocked = !atContact || missingRef;
  const pair = pairKey(at, blackProbe);
  const draft = drafts[pair] ?? { text: '', power: lastPower };
  const activeError = error?.pair === pair ? error : undefined;

  function editDraft(change: Partial<typeof draft>) {
    actions.setDraft(pair, { ...draft, ...change });
    setError(undefined);
  }

  function save() {
    if (blocked) return;
    const reading = parseReading(draft.text, 'voltage');
    if (!reading) {
      const message = draft.text.trim() === '' ? text.emptyVoltage : text.invalidVoltage;
      setError({ pair, message, invalid: true });
      return;
    }
    const result = engine.execute('measurements.add', {
      id: ids.newId('msr'),
      mode: 'voltage',
      at,
      ...(blackProbe && { ref: blackProbe }),
      power: draft.power,
      value: reading.value,
      takenAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setError({ pair, message: commandError(result.error) });
      return;
    }
    actions.clearDraft(pair, draft.power);
    setError(undefined);
    input.current?.focus();
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
      save();
    } else if (event.key === 'Escape') {
      actions.clearDraft(pair);
      setError(undefined);
      event.currentTarget.blur();
    } else {
      return;
    }
    event.preventDefault();
  }

  return (
    <section className="pcbk-measure-block" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{text.title}</h2>
      <dl>
        <dt>{text.at}</dt>
        <dd>
          <span>{atContact ? label(atContact) : text.missingContact}</span>
          {atContact?.pin.name && <span className="bb-field__hint">{atContact.pin.name}</span>}
        </dd>
        <dt>{text.ref}</dt>
        <dd>{refContact ? label(refContact) : blackProbe ? text.missingContact : text.unset}</dd>
      </dl>
      <div className="pcbk-measure-actions">
        <Button onClick={() => useSessionStore.getState().setToolId(PICK_REF_TOOL_ID)}>
          {text.pickRef}
        </Button>
        <Button disabled={!blackProbe} onClick={() => actions.setBlackProbe(null)}>
          {text.clearRef}
        </Button>
        {suggestions.map((suggestion) => {
          const contact = resolveContact(snapshot, suggestion);
          return contact ? (
            <Button key={suggestion.uid} onClick={() => actions.setBlackProbe(suggestion)}>
              {label(contact)}
            </Button>
          ) : null;
        })}
      </div>
      {blocked && (
        <div className="bb-field bb-field__error" id={`${id}-deleted`} role="alert">
          {!atContact && <span>{text.missingAt}</span>}
          {missingRef && <span>{text.missingRef}</span>}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
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
        <Field
          ref={input}
          label={text.voltage}
          hint={text.hint}
          error={activeError?.invalid ? activeError.message : undefined}
          aria-describedby={blocked ? `${id}-deleted` : undefined}
          value={draft.text}
          onChange={(event) => editDraft({ text: event.currentTarget.value })}
          onKeyDown={onValueKey}
        />
        {activeError && !activeError.invalid && (
          <p className="bb-field__error" role="alert">
            {activeError.message}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={blocked}>
          {text.save}
        </Button>
      </form>
    </section>
  );
}
