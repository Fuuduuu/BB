import { componentEt } from './i18n/et';
import { useState } from 'react';
import type { ComponentKind } from '@pcbk/domain';
import type { IdGen } from '@pcbk/contracts';
import { useEngine } from '@pcbk/client';
import { Button, Dialog, Field, et, useSessionStore } from '@pcbk/ui';
import { makeAddComponent } from '../contract';
import { KindField } from './KindField';
import { commandError } from './errors';

// This is a UI allocation guard, not a document/model pin-count restriction.
const maxPinCount = 256;
function suggestedCount(kind: ComponentKind): number {
  if (['hole', 'other', 'switch'].includes(kind)) return 0;
  if (['testpoint', 'via', 'pad', 'wire_point'].includes(kind)) return 1;
  if (['npn', 'pnp', 'nmos', 'pmos', 'regulator'].includes(kind)) return 3;
  if (kind === 'ic') return 8;
  return 2;
}

export function AddComponentDialog({ ids, onClose }: { ids: IdGen; onClose(): void }) {
  const engine = useEngine();
  const [kind, setKind] = useState<ComponentKind>('resistor');
  const [count, setCount] = useState('2');
  const [countError, setCountError] = useState<string>();
  const [error, setError] = useState<string>();
  return (
    <Dialog open title={componentEt.addTitle} onClose={onClose}>
      <form
        className="pcbk-component-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const pinCount = Number(count);
          if (
            !count.trim() ||
            !Number.isSafeInteger(pinCount) ||
            pinCount < 0 ||
            pinCount > maxPinCount
          ) {
            setCountError(componentEt.pinCountInvalid);
            return;
          }
          const params = makeAddComponent(ids, kind, kind === 'hole' ? 0 : pinCount);
          const result = engine.execute('components.add', params);
          if (!result.ok) {
            setError(commandError(result.error));
            return;
          }
          useSessionStore
            .getState()
            .setSelection({ items: [{ kind: 'component', id: params.id }] });
          onClose();
        }}
      >
        <KindField
          value={kind}
          onChange={(next) => {
            setKind(next);
            setCount(String(suggestedCount(next)));
            setCountError(undefined);
            setError(undefined);
          }}
        />
        <Field
          label={componentEt.pinCount}
          type="number"
          inputMode="numeric"
          min={0}
          max={maxPinCount}
          step={1}
          value={count}
          disabled={kind === 'hole'}
          error={countError}
          onChange={(event) => {
            setCount(event.target.value);
            setCountError(undefined);
          }}
        />
        {error && (
          <p className="bb-field__error" role="alert">
            {error}
          </p>
        )}
        <div className="pcbk-component-actions">
          <Button onClick={onClose}>{et.common.cancel}</Button>
          <Button type="submit" variant="primary">
            {componentEt.add}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
