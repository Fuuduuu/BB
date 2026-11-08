import { useState } from 'react';
import type { IdGen } from '@pcbk/contracts';
import { useEngine, useSnapshot } from '@pcbk/client';
import { et } from '@pcbk/ui';
import type { UpdateComponentParams } from '../contract';
import { selectComponent } from '../contract';
import { DraftField } from './DraftField';
import { KindField } from './KindField';
import { PinTable } from './PinTable';
import { commandError } from './errors';

export function ComponentDetails({ id, ids }: { id: string; ids: IdGen }) {
  const engine = useEngine();
  const component = useSnapshot((snapshot) => selectComponent(snapshot, id));
  const [error, setError] = useState<string>();
  if (!component) return <p className="pcbk-components__empty">{et.component.missing}</p>;
  const update = (params: Omit<UpdateComponentParams, 'id'>) => {
    const result = engine.execute('components.update', { id, ...params });
    return result.ok ? undefined : commandError(result.error);
  };
  return (
    <div className="pcbk-component-details">
      <header className="pcbk-component-details__header">
        <h2 className="bb-mono">{component.ref}</h2>
        {!component.board && <span>{et.component.unplaced}</span>}
      </header>
      <div className="pcbk-component-form">
        <DraftField
          label={et.component.ref}
          value={component.ref}
          mono
          commit={(ref) => update({ ref })}
        />
        <KindField value={component.kind} onChange={(kind) => setError(update({ kind }))} />
        <DraftField
          label={et.component.marking}
          value={component.marking}
          placeholder={et.component.markingHint}
          commit={(marking) => update({ marking })}
        />
        <DraftField
          label={et.component.value}
          mono
          value={component.value}
          placeholder={
            component.kind === 'resistor' ? et.component.resistorHint : et.component.valueHint
          }
          commit={(value) => update({ value })}
        />
        <DraftField
          label={et.component.note}
          value={component.note}
          multiline
          commit={(note) => update({ note })}
        />
        <div className="pcbk-component-flags">
          <label>
            <input
              type="checkbox"
              checked={component.identified}
              onChange={(event) => setError(update({ identified: event.target.checked }))}
            />
            {et.component.identified}
          </label>
          <label>
            <input
              type="checkbox"
              checked={component.dnp}
              onChange={(event) => setError(update({ dnp: event.target.checked }))}
            />
            {et.component.dnp}
          </label>
        </div>
        {error && (
          <p className="bb-field__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <PinTable component={component} ids={ids} />
    </div>
  );
}
