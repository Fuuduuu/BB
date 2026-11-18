import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { Snapshot } from '@pcbk/contracts';
import { Button, useSessionStore } from '@pcbk/ui';
import { create } from 'zustand';
import { selectComponent } from '../contract';
import { DraftField } from './DraftField';
import { commandError } from './errors';
import { componentEt } from './i18n/et';

type ReadonlyComponent = Snapshot['doc']['components'][number];
type ReadonlyPin = ReadonlyComponent['pins'][number];

export const usePinNameFocus = create<{ requestedUid: string | null }>(() => ({
  requestedUid: null,
}));

export function PinCard({ componentId, pinId }: { componentId: string; pinId: string }) {
  const component = useSnapshot((snapshot) => selectComponent(snapshot, componentId));
  const pin = component?.pins.find(({ id }) => id === pinId);
  if (!component || !pin) {
    return <p className="pcbk-components__empty">{componentEt.missing}</p>;
  }
  return <PinFields key={`${component.id}:${pin.uid}`} component={component} pin={pin} />;
}

function PinFields({ component, pin }: { component: ReadonlyComponent; pin: ReadonlyPin }) {
  const engine = useEngine();
  const headingId = useId();
  const [error, setError] = useState<string>();
  const nameInput = useRef<HTMLInputElement>(null);
  const focusRequested = usePinNameFocus((state) => state.requestedUid === pin.uid);
  useLayoutEffect(() => {
    if (!focusRequested) return;
    nameInput.current?.focus();
    usePinNameFocus.setState({ requestedUid: null });
  }, [focusRequested]);
  return (
    <section className="pcbk-component-details" aria-labelledby={headingId}>
      <header className="pcbk-component-details__header">
        <h2 id={headingId} className="bb-mono">
          {component.ref}.{pin.id}
        </h2>
      </header>
      <div className="pcbk-component-form">
        <DraftField
          label={componentEt.namePin(pin.id)}
          value={pin.name ?? ''}
          inputRef={nameInput}
          commit={(name) => {
            const result = engine.execute('components.renamePin', {
              id: component.id,
              pinId: pin.id,
              name: name || null,
            });
            return result.ok ? undefined : commandError(result.error);
          }}
        />
        <div className="pcbk-component-flags">
          <label>
            <input
              type="checkbox"
              aria-label={componentEt.ncPin(pin.id)}
              checked={pin.nc}
              onChange={(event) => {
                const result = engine.execute('components.setNc', {
                  id: component.id,
                  pinId: pin.id,
                  nc: event.target.checked,
                });
                setError(result.ok ? undefined : commandError(result.error));
              }}
            />
            {componentEt.nc}
          </label>
        </div>
        {error && (
          <p className="bb-field__error" role="alert">
            {error}
          </p>
        )}
        <Button
          onClick={() =>
            useSessionStore.getState().setSelection({
              items: [{ kind: 'component', id: component.id }],
            })
          }
        >
          {componentEt.backToComponent}
        </Button>
      </div>
    </section>
  );
}
