import { useId, useState } from 'react';
import { Button, Field } from '@pcbk/ui';
import type { FootprintParams } from '@pcbk/domain/footprints';
import type { LibraryEntry } from '../contract';
import { placementEt } from './i18n/et';
import { beginPlacement, usePlaceStore } from './place-store';
import {
  chipSizes,
  footprintPinCounts,
  headerPitches,
  libraryName,
  positiveDecimal,
  searchLibrary,
} from './placement';

function OptionField<T extends string | number>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string | number | undefined;
  choices: readonly T[];
  onChange(value: T): void;
}) {
  const id = useId();
  return (
    <div className="bb-field">
      <label htmlFor={id} className="bb-field__label">
        {label}
      </label>
      <select
        id={id}
        className="bb-input"
        value={value}
        onChange={(event) => {
          const next = choices.find((choice) => String(choice) === event.target.value);
          if (next !== undefined) onChange(next);
        }}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {typeof choice === 'number' ? choice.toLocaleString('et') : choice}
          </option>
        ))}
      </select>
    </div>
  );
}

function LibraryParameters({ entry }: { entry: LibraryEntry }) {
  const [params, setParams] = useState<FootprintParams>(entry.params);
  const labels = placementEt.params;
  const counts = footprintPinCounts[entry.footprint];
  const isArea = entry.footprint === 'area';
  const width = positiveDecimal(String(params.w ?? ''));
  const height = positiveDecimal(String(params.h ?? ''));
  const placementParams = isArea
    ? width !== undefined && height !== undefined
      ? { w: width, h: height }
      : undefined
    : params;
  const setParam = (key: string, value: string | number) =>
    setParams((previous) => ({ ...previous, [key]: value }));
  return (
    <div className="pcbk-library__params">
      {entry.footprint === 'chip' && (
        <OptionField
          label={labels.size}
          value={params.size}
          choices={chipSizes}
          onChange={(size) => setParam('size', size)}
        />
      )}
      {counts && (
        <OptionField
          label={labels.pins}
          value={params.pins}
          choices={counts}
          onChange={(pins) => setParam('pins', pins)}
        />
      )}
      {entry.footprint === 'header1' && (
        <OptionField
          label={labels.pitch}
          value={params.pitch}
          choices={headerPitches}
          onChange={(pitch) => setParam('pitch', pitch)}
        />
      )}
      {isArea && (
        <>
          <Field
            label={labels.width}
            inputMode="decimal"
            value={params.w}
            error={width === undefined ? labels.positive : undefined}
            onChange={(event) => setParam('w', event.target.value)}
          />
          <Field
            label={labels.height}
            inputMode="decimal"
            value={params.h}
            error={height === undefined ? labels.positive : undefined}
            onChange={(event) => setParam('h', event.target.value)}
          />
        </>
      )}
      <Button
        variant="primary"
        disabled={!placementParams}
        onClick={() => {
          if (placementParams) {
            beginPlacement({ mode: 'new', entryId: entry.id, params: placementParams });
          }
        }}
      >
        {placementEt.tool}
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
        <ul className="pcbk-components__list">
          {matches.map((entry) => (
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
