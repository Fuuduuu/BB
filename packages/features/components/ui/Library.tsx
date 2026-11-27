import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useEngine } from '@pcbk/client';
import type { IdGen } from '@pcbk/contracts';
import { Button, Field, useSessionStore, useViewStore } from '@pcbk/ui';
import { schematicSymbolId } from '@pcbk/domain/schematic';
import { footprintGeometry, type FootprintParams } from '@pcbk/domain/footprints';
import type { LibraryEntry } from '../contract';
import { placementEt } from './i18n/et';
import { FootprintPreview, FootprintSilhouette } from './FootprintPreview';
import { FootprintParameters, validatedFootprintParams } from './FootprintParameters';
import { addPlacedComponent } from './PlaceTool';
import { beginPlacement, updatePlacementParams, usePlaceStore } from './place-store';
import type { PlacementAnchor } from './place-store';
import { libraryName, searchLibrary } from './placement';

function cancelAnchor() {
  usePlaceStore.getState().reset();
}

function AnchoredPlacementActions({
  ids,
  entry,
  params,
  anchor,
}: {
  ids: IdGen;
  entry: LibraryEntry;
  params: FootprintParams | undefined;
  anchor: PlacementAnchor;
}) {
  const engine = useEngine();
  return (
    <div className="pcbk-library__anchor-actions">
      <Button
        variant="primary"
        disabled={!params}
        onClick={() => {
          if (!params) return;
          const id = addPlacedComponent(engine, ids, entry, params, anchor);
          if (id === null) return;
          useSessionStore.getState().setSelection({ items: [{ kind: 'component', id }] });
          cancelAnchor();
        }}
      >
        {placementEt.placeHere}
      </Button>
      <Button onClick={cancelAnchor}>{placementEt.cancelHere}</Button>
    </div>
  );
}

function LibraryParameters({
  entry,
  ids,
  anchor,
}: {
  entry: LibraryEntry;
  ids?: IdGen;
  anchor: PlacementAnchor | null;
}) {
  const [params, setParams] = useState<FootprintParams>(entry.params);
  const isPlacing = usePlaceStore(
    ({ request }) => request?.mode === 'new' && request.entryId === entry.id,
  );
  const placementParams = validatedFootprintParams(entry, params);
  const setParam = (key: string, value: string | number) => {
    const next = { ...params, [key]: value };
    setParams(next);
    if (isPlacing) updatePlacementParams(validatedFootprintParams(entry, next) ?? null);
  };
  return (
    <div className="pcbk-library__params">
      <FootprintParameters entry={entry} params={params} onChange={setParam} />
      <FootprintPreview
        name={libraryName(entry.id)}
        footprint={entry.footprint}
        geometry={placementParams && footprintGeometry(entry.footprint, placementParams)}
      />
      {anchor && ids ? (
        <AnchoredPlacementActions
          ids={ids}
          entry={entry}
          params={placementParams}
          anchor={anchor}
        />
      ) : (
        <Button
          variant="primary"
          disabled={!isPlacing && !placementParams}
          title={isPlacing ? placementEt.stopPlacingTitle : undefined}
          onClick={() => {
            if (isPlacing) {
              usePlaceStore.getState().reset();
              const session = useSessionStore.getState();
              session.setPreview(null);
              session.setToolId('select');
            } else if (placementParams) {
              beginPlacement({ mode: 'new', entryId: entry.id, params: placementParams });
            }
          }}
        >
          {isPlacing ? placementEt.stopPlacing : placementEt.tool}
        </Button>
      )}
    </div>
  );
}

export function Library({ ids }: { ids?: IdGen }) {
  const [query, setQuery] = useState('');
  const [entryId, setEntryId] = useState<string>();
  const subtitleId = useId();
  const search = useRef<HTMLInputElement>(null);
  const schematic = useViewStore((state) => state.activeView === 'schematic');
  const entries = searchLibrary(query);
  const matches = schematic
    ? entries.filter(({ kind }) => schematicSymbolId(kind) !== null)
    : entries;
  const anchor = usePlaceStore((state) => state.anchor);
  const error = usePlaceStore((state) =>
    state.request?.mode === 'new' || state.anchor ? state.error : null,
  );
  useLayoutEffect(() => {
    if (anchor) search.current?.focus({ preventScroll: true });
  }, [anchor]);
  return (
    <div className="pcbk-components">
      <div className="pcbk-library__search">
        <Field
          ref={search}
          type="search"
          label={placementEt.library.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {anchor && !matches.some((entry) => entry.id === entryId) && (
          <Button onClick={cancelAnchor}>{placementEt.cancelHere}</Button>
        )}
      </div>
      {error && (
        <p className="pcbk-components__error bb-field__error" role="alert">
          {error}
        </p>
      )}
      {matches.length ? (
        <div className="pcbk-library__groups">
          {Object.entries(placementEt.library.categories).map(([category, title]) => {
            const categoryEntries = matches.filter((entry) => entry.category === category);
            if (!categoryEntries.length) return null;
            return (
              <section key={category} className="pcbk-library__group">
                <h3 className="pcbk-library__category">{title}</h3>
                <ul className="pcbk-components__list">
                  {categoryEntries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className="pcbk-component-row pcbk-library__row"
                        aria-label={libraryName(entry.id)}
                        aria-describedby={entry.id === 'unknown' ? subtitleId : undefined}
                        aria-expanded={entryId === entry.id}
                        onClick={() =>
                          setEntryId((previous) => (previous === entry.id ? undefined : entry.id))
                        }
                      >
                        <span className="pcbk-library__silhouette-slot">
                          <FootprintSilhouette entryId={entry.id} />
                        </span>
                        <span className="pcbk-component-row__body">
                          <span>{libraryName(entry.id)}</span>
                          {entry.id === 'unknown' && (
                            <span id={subtitleId} className="pcbk-component-row__value">
                              {placementEt.library.unknownSubtitle}
                            </span>
                          )}
                        </span>
                      </button>
                      {entryId === entry.id && (
                        <LibraryParameters entry={entry} ids={ids} anchor={anchor} />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="pcbk-components__empty">
          {placementEt.library.emptyBefore}
          <button
            type="button"
            className="pcbk-components__text-button"
            onClick={() => {
              setQuery('');
              setEntryId('unknown');
            }}
          >
            {placementEt.library.custom}
          </button>
          {placementEt.library.emptyAfter}
        </p>
      )}
    </div>
  );
}
