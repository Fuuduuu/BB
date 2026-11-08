import { useState } from 'react';
import type { IdGen } from '@pcbk/contracts';
import { useSnapshot } from '@pcbk/client';
import { Button, et, useSessionStore } from '@pcbk/ui';
import { selectComponents } from '../contract';
import { AddComponentDialog } from './AddComponentDialog';

export function ComponentList({ ids }: { ids: IdGen }) {
  const components = useSnapshot(selectComponents);
  const selection = useSessionStore((s) => s.selection);
  const selectedId =
    selection.kind === 'component'
      ? selection.id
      : selection.kind === 'pin'
        ? selection.componentId
        : null;
  const [adding, setAdding] = useState(false);
  return (
    <div className="pcbk-components">
      <div className="pcbk-components__toolbar">
        <Button variant="primary" onClick={() => setAdding(true)}>
          {et.component.add}
        </Button>
        <span className="pcbk-components__count bb-mono">{components.length}</span>
      </div>
      {components.length ? (
        <ul className="pcbk-components__list">
          {components.map((component) => (
            <li key={component.id}>
              <button
                type="button"
                className="pcbk-component-row"
                aria-label={et.component.select(component.ref)}
                aria-pressed={selectedId === component.id}
                onClick={() =>
                  useSessionStore.getState().setSelection({ kind: 'component', id: component.id })
                }
              >
                <span className="pcbk-component-row__ref bb-mono">{component.ref}</span>
                <span className="pcbk-component-row__body">
                  <span>{et.component.kinds[component.kind]}</span>
                  <span className="pcbk-component-row__value bb-mono">{component.value}</span>
                </span>
                {!component.board && (
                  <span
                    className="pcbk-component-row__unplaced"
                    title={et.component.unplaced}
                    aria-label={et.component.unplaced}
                  >
                    ○
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pcbk-components__empty">{et.component.empty}</p>
      )}
      {adding && <AddComponentDialog ids={ids} onClose={() => setAdding(false)} />}
    </div>
  );
}
