import type { Snapshot } from '@pcbk/contracts';
import type { MeasuredPin } from '@pcbk/domain';
import { Button, useSessionStore } from '@pcbk/ui';
import { resolveContact } from './contacts';
import { measureEt as text } from './i18n/et';
import { useMeasureStore } from './measure-store';
import { PICK_REF_TOOL_ID } from './PickRefTool';

function label(contact: NonNullable<ReturnType<typeof resolveContact>>): string {
  return `${contact.component.ref}.${contact.pin.id}`;
}

export function ProbeRows({
  snapshot,
  at,
  blackProbe,
  suggestions,
}: {
  snapshot: Snapshot;
  at: MeasuredPin;
  blackProbe: MeasuredPin | null;
  suggestions: MeasuredPin[];
}) {
  const picking = useSessionStore((state) => state.toolId === PICK_REF_TOOL_ID);
  const setBlackProbe = useMeasureStore((state) => state.setBlackProbe);
  const atContact = resolveContact(snapshot, at);
  const refContact = blackProbe && resolveContact(snapshot, blackProbe);
  return (
    <div className="pcbk-probe-rows">
      <div className="pcbk-probe-row" role="group" aria-label={text.redProbe}>
        <div className="pcbk-probe-label">
          <span className="pcbk-probe-dot pcbk-probe-dot--red" aria-hidden="true" />
          <span>
            {text.redProbe} ·{' '}
            <span className="bb-mono">{atContact ? label(atContact) : text.missingContact}</span>
          </span>
        </div>
        {atContact?.pin.name && <span className="bb-field__hint">{atContact.pin.name}</span>}
      </div>
      <div
        className="pcbk-probe-row"
        role="group"
        aria-label={text.blackProbe}
        data-picking={picking}
      >
        <div className="pcbk-probe-label">
          <span className="pcbk-probe-dot pcbk-probe-dot--black" aria-hidden="true" />
          <span>
            {text.blackProbe} ·{' '}
            <span className="bb-mono">
              {picking
                ? text.pickingBlack
                : refContact
                  ? label(refContact)
                  : blackProbe
                    ? text.missingContact
                    : text.unset}
            </span>
          </span>
        </div>
        {!picking && refContact?.pin.name && (
          <span className="bb-field__hint">{refContact.pin.name}</span>
        )}
        <div className="pcbk-measure-actions">
          <Button onClick={() => useSessionStore.getState().setToolId(PICK_REF_TOOL_ID)}>
            {text.pickBlack}
          </Button>
          <Button disabled={!blackProbe} onClick={() => setBlackProbe(null)}>
            {text.clearRef}
          </Button>
          {suggestions.map((suggestion) => {
            const contact = resolveContact(snapshot, suggestion);
            return contact ? (
              <Button key={suggestion.uid} onClick={() => setBlackProbe(suggestion)}>
                {label(contact)}
              </Button>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
