import { useId, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { Snapshot } from '@pcbk/contracts';
import { schematicContacts, schematicSymbol } from '@pcbk/domain/schematic';
import { Button } from '@pcbk/ui';
import { schematicEt } from './i18n/et';
import './pin-function.css';

type Component = Snapshot['doc']['components'][number];

function PinFunctionForm({
  component,
  contacts,
  current,
  boxed,
}: {
  component: Component;
  contacts: readonly string[];
  current: readonly string[];
  boxed: boolean;
}) {
  const engine = useEngine();
  const fieldId = useId();
  const [draft, setDraft] = useState(current);
  const pinIds = new Set(component.pins.map(({ id }) => id));
  const canSave =
    new Set(draft).size === contacts.length &&
    draft.every((id) => pinIds.has(id)) &&
    draft.some((id, index) => id !== current[index]);

  function save() {
    if (!canSave) return;
    engine.execute('schematic.setSymbol', {
      id: component.id,
      pinMap: Object.fromEntries(contacts.map((contact, index) => [contact, draft[index]!])),
    });
  }

  return (
    <>
      {boxed && <p>{schematicEt.pinFunction.ambiguous}</p>}
      {contacts.map((contact, index) => {
        const id = `${fieldId}-${index}`;
        const label = schematicEt.pinFunction.contact(contact);
        return (
          <div key={contact} className="bb-field">
            <label className="bb-field__label" htmlFor={id}>
              {label}
            </label>
            <select
              id={id}
              className="bb-input"
              aria-label={label}
              value={draft[index]}
              onChange={(event) => {
                const next = event.target.value;
                setDraft((values) => values.map((id, other) => (other === index ? next : id)));
              }}
            >
              <option value="">{schematicEt.pinFunction.unassigned}</option>
              {component.pins.map(({ id, name }) => (
                <option key={id} value={id}>
                  {schematicEt.pinFunction.pin(id, name)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      <div className="pcbk-pin-function__actions">
        <Button variant="primary" disabled={!canSave} onClick={save}>
          {schematicEt.pinFunction.save}
        </Button>
        {component.schematic?.pinMap && (
          <Button
            onClick={() =>
              engine.execute('schematic.setSymbol', { id: component.id, pinMap: null })
            }
          >
            {schematicEt.pinFunction.useNames}
          </Button>
        )}
      </div>
    </>
  );
}

export function PinFunction({ id }: { id: string }) {
  const component = useSnapshot((snapshot) =>
    snapshot.doc.components.find((component) => component.id === id),
  );
  if (!component?.schematic) return null;

  const contacts = schematicContacts(component.kind);
  if (contacts.length === 0) return null;
  const symbol = schematicSymbol(component);
  const boxed = symbol?.id === 'box';
  const current = contacts.map((contact) =>
    boxed ? '' : (symbol?.pins.find((pin) => pin.contact === contact)?.pinId ?? ''),
  );

  return (
    <div className="pcbk-pin-function">
      <h3>{schematicEt.pinFunction.title}</h3>
      {contacts.length !== component.pins.length ? (
        <p>{schematicEt.pinFunction.countMismatch(contacts.length, component.pins.length)}</p>
      ) : (
        <PinFunctionForm
          key={JSON.stringify([id, contacts, component.schematic.pinMap, current])}
          component={component}
          contacts={contacts}
          current={current}
          boxed={boxed}
        />
      )}
    </div>
  );
}
