import { useId, useState } from 'react';
import { Button, Field, useSessionStore } from '@pcbk/ui';
import { footprintGeometry, type FootprintParams } from '@pcbk/domain/footprints';
import type { LibraryEntry } from '../contract';
import { placementEt } from './i18n/et';
import { FootprintPreview } from './FootprintPreview';
import { beginPlacement, usePlaceStore } from './place-store';
import {
  libraryName,
  numericParameter,
  parameterLabel,
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
  const isPlacing = usePlaceStore(
    ({ request }) => request?.mode === 'new' && request.entryId === entry.id,
  );
  const labels = placementEt.params;
  const isArea = entry.footprint === 'area';
  const width = positiveDecimal(String(params.w ?? ''));
  const height = positiveDecimal(String(params.h ?? ''));
  const validatedParams: FootprintParams = { ...params };
  let valid = true;
  for (const spec of entry.paramSpec) {
    if ('choices' in spec) continue;
    const value = numericParameter(String(params[spec.key] ?? ''), spec);
    if (value === undefined) valid = false;
    else validatedParams[spec.key] = value;
  }
  const placementParams = isArea
    ? width !== undefined && height !== undefined
      ? { w: width, h: height }
      : undefined
    : valid
      ? validatedParams
      : undefined;
  const setParam = (key: string, value: string | number) =>
    setParams((previous) => ({ ...previous, [key]: value }));
  return (
    <div className="pcbk-library__params">
      {entry.paramSpec.map((spec) =>
        'choices' in spec ? (
          <OptionField
            key={spec.key}
            label={parameterLabel(spec.label)}
            value={params[spec.key]}
            choices={spec.choices}
            onChange={(value) => setParam(spec.key, value)}
          />
        ) : (
          <Field
            key={spec.key}
            label={parameterLabel(spec.label)}
            inputMode={spec.step === 1 ? 'numeric' : 'decimal'}
            value={params[spec.key]}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            error={
              numericParameter(String(params[spec.key] ?? ''), spec) === undefined
                ? labels.range(spec.min, spec.max, spec.step)
                : undefined
            }
            onChange={(event) => setParam(spec.key, event.target.value)}
          />
        ),
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
