import { componentEt } from './i18n/et';
import { useState } from 'react';
import type { IdGen } from '@pcbk/contracts';
import { useEngine, useSnapshot } from '@pcbk/client';
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
  if (!component) return <p className="pcbk-components__empty">{componentEt.missing}</p>;
  const update = (params: Omit<UpdateComponentParams, 'id'>) => {
    const result = engine.execute('components.update', { id, ...params });
    return result.ok ? undefined : commandError(result.error);
  };
  return (
    <div className="pcbk-component-details">
      <header className="pcbk-component-details__header">
        <h2 className="bb-mono">{component.ref}</h2>
        {!component.board && <span>{componentEt.unplaced}</span>}
      </header>
      <div className="pcbk-component-form">
        <DraftField
          label={componentEt.ref}
          value={component.ref}
          mono
          commit={(ref) => update({ ref })}
        />
        <KindField value={component.kind} onChange={(kind) => setError(update({ kind }))} />
        <DraftField
          label={componentEt.marking}
          value={component.marking}
          placeholder={componentEt.markingHint}
          commit={(marking) => update({ marking })}
        />
        <DraftField
          label={componentEt.value}
          mono
          value={component.value}
          placeholder={
            component.kind === 'resistor' ? componentEt.resistorHint : componentEt.valueHint
          }
          commit={(value) => update({ value })}
        />
        <DraftField
          label={componentEt.note}
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
            {componentEt.identified}
          </label>
          <label>
            <input
              type="checkbox"
              checked={component.dnp}
              onChange={(event) => setError(update({ dnp: event.target.checked }))}
            />
            {componentEt.dnp}
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
