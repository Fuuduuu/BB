import { useId, useState } from 'react';
import { Button, Field, useSessionStore } from '@pcbk/ui';
import { footprintGeometry, type FootprintParams } from '@pcbk/domain/footprints';
import type { LibraryEntry } from '../contract';
import { placementEt } from './i18n/et';
import { FootprintPreview } from './FootprintPreview';
import { FootprintParameters, validatedFootprintParams } from './FootprintParameters';
import { beginPlacement, usePlaceStore } from './place-store';
import { libraryName, searchLibrary } from './placement';

function LibraryParameters({ entry }: { entry: LibraryEntry }) {
  const [params, setParams] = useState<FootprintParams>(entry.params);
  const isPlacing = usePlaceStore(
    ({ request }) => request?.mode === 'new' && request.entryId === entry.id,
  );
  const placementParams = validatedFootprintParams(entry, params);
  const setParam = (key: string, value: string | number) =>
    setParams((previous) => ({ ...previous, [key]: value }));
  return (
    <div className="pcbk-library__params">
      <FootprintParameters entry={entry} params={params} onChange={setParam} />
      <FootprintPreview
        name={libraryName(entry.id)}
        geometry={placementParams && footprintGeometry(entry.footprint, placementParams)}
      />
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
    </div>
  );
}

export function Library() {
  const [query, setQuery] = useState('');
  const [entryId, setEntryId] = useState<string>();
  const subtitleId = useId();
  const matches = searchLibrary(query);
  const error = usePlaceStore((state) => (state.request?.mode === 'new' ? state.error : null));
  return (
    <div className="pcbk-components">
      <div className="pcbk-library__search">
        <Field
          type="search"
          label={placementEt.library.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {error && (
        <p className="pcbk-components__error bb-field__error" role="alert">
          {error}
        </p>
      )}
      {matches.length ? (
        <div className="pcbk-library__groups">
          {Object.entries(placementEt.library.categories).map(([category, title]) => {
            const entries = matches.filter((entry) => entry.category === category);
            if (!entries.length) return null;
            return (
              <section key={category} className="pcbk-library__group">
                <h3 className="pcbk-library__category">{title}</h3>
                <ul className="pcbk-components__list">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className="pcbk-component-row"
                        aria-label={libraryName(entry.id)}
                        aria-describedby={entry.id === 'unknown' ? subtitleId : undefined}
                        aria-expanded={entryId === entry.id}
                        onClick={() =>
                          setEntryId((previous) => (previous === entry.id ? undefined : entry.id))
                        }
                      >
                        <span className="pcbk-component-row__body">
                          <span>{libraryName(entry.id)}</span>
                          {entry.id === 'unknown' && (
                            <span id={subtitleId} className="pcbk-component-row__value">
                              {placementEt.library.unknownSubtitle}
                            </span>
                          )}
                        </span>
                      </button>
                      {entryId === entry.id && <LibraryParameters entry={entry} />}
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
