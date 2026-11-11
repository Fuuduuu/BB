import { useId, useState } from 'react';
import { useSnapshot } from '@pcbk/client';
import type { IdGen, Snapshot } from '@pcbk/contracts';
import { Button } from '@pcbk/ui';
import { COMPONENT_LIBRARY, selectComponents } from '../contract';
import { AddComponentDialog } from './AddComponentDialog';
import { ComponentList } from './ComponentList';
import { componentEt, placementEt } from './i18n/et';
import { beginPlacement, usePlaceStore } from './place-store';
import { compatiblePlacement, libraryName } from './placement';

function FootprintChoices({
  component,
  onPlace,
}: {
  component: Snapshot['doc']['components'][number];
  onPlace(): void;
}) {
  const id = useId();
  return (
    <ul className="pcbk-unplaced__choices" aria-label={placementEt.unplaced.choose}>
      {COMPONENT_LIBRARY.map((entry) => {
        const option = compatiblePlacement(entry, component.pins);
        const descriptionId = option.reason ? `${id}-${entry.id}` : undefined;
        return (
          <li key={entry.id}>
            <Button
              disabled={Boolean(option.reason)}
              aria-describedby={descriptionId}
              onClick={() => {
                if (!('params' in option)) return;
                beginPlacement({
                  mode: 'existing',
                  componentId: component.id,
                  footprint: entry.footprint,
                  params: option.params,
                });
                onPlace();
              }}
            >
              {libraryName(entry.id)}
            </Button>
            {option.reason && (
              <p id={descriptionId} className="bb-field__hint">
                {option.reason}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function UnplacedList({ ids }: { ids: IdGen }) {
  const unplaced = useSnapshot((snapshot) => {
    const unplacedIds = new Set(snapshot.derived.unplacedBoard);
    return selectComponents(snapshot).filter((component) => unplacedIds.has(component.id));
  });
  const [adding, setAdding] = useState(false);
  const [choosingId, setChoosingId] = useState<string>();
  const error = usePlaceStore((state) => (state.request?.mode === 'existing' ? state.error : null));
  return (
    <div className="pcbk-components">
      <div className="pcbk-components__toolbar">
        <Button variant="primary" onClick={() => setAdding(true)}>
          {componentEt.add}
        </Button>
      </div>
      {error && (
        <p className="pcbk-components__error bb-field__error" role="alert">
          {error}
        </p>
      )}
      {unplaced.length ? (
        <ComponentList
          components={unplaced}
          renderActions={(component) => (
            <div className="pcbk-unplaced__actions">
              <Button
                aria-expanded={choosingId === component.id}
                onClick={() =>
                  setChoosingId((previous) =>
                    previous === component.id ? undefined : component.id,
                  )
                }
              >
                {placementEt.unplaced.place}
              </Button>
              {choosingId === component.id && (
                <FootprintChoices component={component} onPlace={() => setChoosingId(undefined)} />
              )}
            </div>
          )}
        />
      ) : (
        <p className="pcbk-components__empty">{placementEt.unplaced.empty}</p>
      )}
      {adding && <AddComponentDialog ids={ids} onClose={() => setAdding(false)} />}
    </div>
  );
}
