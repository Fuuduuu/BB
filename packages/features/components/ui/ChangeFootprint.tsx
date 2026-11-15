import { useId, useRef, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { IdGen } from '@pcbk/contracts';
import {
  FOOTPRINTS,
  footprintGeometry,
  footprintPinIds,
  type FootprintParams,
} from '@pcbk/domain/footprints';
import { Button, Dialog } from '@pcbk/ui';
import { COMPONENT_LIBRARY, selectComponent } from '../contract';
import { FootprintParameters, validatedFootprintParams } from './FootprintParameters';
import { FootprintPreview } from './FootprintPreview';
import { commandError } from './errors';
import { footprintImpact, pinRanges } from './footprint-impact';
import { placementEt } from './i18n/et';
import { libraryName } from './placement';

function initialLibraryEntry(component: ReturnType<typeof selectComponent>) {
  const board = component?.board;
  const candidates = COMPONENT_LIBRARY.filter((entry) => entry.footprint === board?.footprint);
  const params = {
    ...FOOTPRINTS.find(({ key }) => key === board?.footprint)?.defaults,
    ...board?.params,
  };
  const sameFamily = candidates.filter((entry) => {
    const editable = new Set(entry.paramSpec.map(({ key }) => key));
    return Object.entries(entry.params).every(([key, value]) => {
      const actual = params[key];
      return (
        editable.has(key) ||
        actual === value ||
        (typeof value === 'number' &&
          typeof actual === 'string' &&
          actual.trim() !== '' &&
          Number(actual) === value)
      );
    });
  });
  const matches = sameFamily.length > 0 ? sameFamily : candidates;
  return (
    matches.find((entry) => entry.kind === component?.kind) ??
    matches[0] ??
    COMPONENT_LIBRARY.find(({ id }) => id === 'unknown')!
  );
}

export function ChangeFootprint({ id, ids, onClose }: { id: string; ids: IdGen; onClose(): void }) {
  const engine = useEngine();
  const component = useSnapshot((snapshot) => selectComponent(snapshot, id));
  const initialEntry = initialLibraryEntry(component);
  const [entryId, setEntryId] = useState(initialEntry.id);
  const [params, setParams] = useState<FootprintParams>({
    ...initialEntry.params,
    ...component?.board?.params,
  });
  const [pending, setPending] = useState<ReturnType<typeof footprintImpact>>();
  const [error, setError] = useState<string>();
  const applyRef = useRef<HTMLButtonElement>(null);
  const selectorId = useId();
  const text = placementEt.change;
  const entry = COMPONENT_LIBRARY.find(({ id }) => id === entryId)!;
  const validated = validatedFootprintParams(entry, params);
  const geometry = validated && footprintGeometry(entry.footprint, validated);
  const closeDialog = () => {
    setPending(undefined);
    applyRef.current?.focus();
  };
  const apply = (confirmed = false) => {
    if (!validated) return;
    const snapshot = engine.snapshot();
    const current = selectComponent(snapshot, id);
    const targetIds =
      entry.footprint === 'area'
        ? current?.pins.map(({ id }) => id)
        : footprintPinIds(entry.footprint, validated);
    if (!current?.board || !targetIds) return;
    const impact = footprintImpact(current, snapshot.doc.measurements, targetIds);
    if (impact.hasImpact && (!confirmed || pending?.key !== impact.key)) {
      setPending(impact);
      return;
    }
    const existing = new Set(current.pins.map(({ id }) => id));
    const newPinUids = Object.fromEntries(
      targetIds.filter((pinId) => !existing.has(pinId)).map((pinId) => [pinId, ids.newId('pin')]),
    );
    const result = engine.execute('components.changeFootprint', {
      id,
      footprint: entry.footprint,
      params: validated,
      newPinUids,
    });
    setPending(undefined);
    if (result.ok) onClose();
    else {
      setError(commandError(result.error));
      applyRef.current?.focus();
    }
  };
  return (
    <section className="pcbk-component-form" aria-label={text.editor}>
      <div className="bb-field">
        <label htmlFor={selectorId} className="bb-field__label">
          {text.choose}
        </label>
        <select
          id={selectorId}
          className="bb-input"
          value={entryId}
          onChange={(event) => {
            const next = COMPONENT_LIBRARY.find(({ id }) => id === event.target.value)!;
            setEntryId(next.id);
            setParams(next.params);
            setError(undefined);
          }}
        >
          {Object.entries(placementEt.library.categories).map(([category, title]) => (
            <optgroup key={category} label={title}>
              {COMPONENT_LIBRARY.filter((entry) => entry.category === category).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {libraryName(entry.id)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <FootprintParameters
        entry={entry}
        params={params}
        onChange={(key, value) => setParams((previous) => ({ ...previous, [key]: value }))}
      />
      <FootprintPreview name={libraryName(entry.id)} geometry={geometry} />
      {error && (
        <p className="bb-field__error" role="alert">
          {error}
        </p>
      )}
      <div className="pcbk-component-actions">
        <Button onClick={onClose}>{text.cancel}</Button>
        <Button ref={applyRef} variant="primary" disabled={!geometry} onClick={() => apply()}>
          {text.apply}
        </Button>
      </div>
      <Dialog open={pending !== undefined} title={text.title} onClose={closeDialog}>
        {pending && <p>{text.impact(pinRanges(pending.pinIds), pending)}</p>}
        <div className="pcbk-component-actions">
          <Button autoFocus onClick={closeDialog}>
            {text.cancel}
          </Button>
          <Button variant="primary" onClick={() => apply(true)}>
            {text.apply}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
