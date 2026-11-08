import { useId, useState } from 'react';
import type { IdGen } from '@pcbk/contracts';
import type { Snapshot } from '@pcbk/contracts';
import { useEngine } from '@pcbk/client';
import { Button, et } from '@pcbk/ui';
import { DraftField } from './DraftField';
import { commandError } from './errors';

type ReadonlyComponent = Snapshot['doc']['components'][number];
export function PinTable({ component, ids }: { component: ReadonlyComponent; ids: IdGen }) {
  const engine = useEngine();
  const headingId = useId();
  const [error, setError] = useState<string>();
  const id = component.id;
  return (
    <section className="pcbk-component-pins" aria-labelledby={headingId}>
      <div className="pcbk-component-pins__heading">
        <h3 id={headingId}>{et.component.pins}</h3>
        <Button
          onClick={() => {
            const used = new Set(component.pins.map((pin) => pin.id));
            let next = 1;
            while (used.has(String(next))) next++;
            const result = engine.execute('components.addPin', {
              id,
              pin: { id: String(next), uid: ids.newId('pin') },
            });
            setError(result.ok ? undefined : commandError(result.error));
          }}
        >
          {et.component.addPin}
        </Button>
      </div>
      {component.pins.length ? (
        <table className="pcbk-pin-table">
          <thead>
            <tr>
              <th scope="col">{et.component.pinId}</th>
              <th scope="col">{et.component.pinName}</th>
              <th scope="col">{et.component.nc}</th>
              <th scope="col">{et.component.remove}</th>
            </tr>
          </thead>
          <tbody>
            {component.pins.map((pin) => (
              <tr key={pin.uid}>
                <th scope="row" className="bb-mono">
                  {pin.id}
                </th>
                <td>
                  <DraftField
                    label={et.component.namePin(pin.id)}
                    value={pin.name ?? ''}
                    commit={(name) => {
                      const result = engine.execute('components.renamePin', {
                        id,
                        pinId: pin.id,
                        name: name || null,
                      });
                      return result.ok ? undefined : commandError(result.error);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={et.component.ncPin(pin.id)}
                    checked={pin.nc}
                    onChange={(event) => {
                      const result = engine.execute('components.setNc', {
                        id,
                        pinId: pin.id,
                        nc: event.target.checked,
                      });
                      setError(result.ok ? undefined : commandError(result.error));
                    }}
                  />
                </td>
                <td>
                  <Button
                    variant="ghost"
                    aria-label={et.component.removePin(pin.id)}
                    onClick={() => {
                      const result = engine.execute('components.removePin', { id, pinId: pin.id });
                      setError(result.ok ? undefined : commandError(result.error));
                    }}
                  >
                    <span aria-hidden="true">×</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="pcbk-components__empty">{et.component.noPins}</p>
      )}
      {error && (
        <p className="bb-field__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
