import { useId } from 'react';
import { Field } from '@pcbk/ui';
import type { FootprintParams } from '@pcbk/domain/footprints';
import type { LibraryEntry } from '../contract';
import { placementEt } from './i18n/et';
import { numericParameter, parameterLabel, positiveDecimal } from './placement';

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

export function validatedFootprintParams(
  entry: LibraryEntry,
  params: FootprintParams,
): FootprintParams | undefined {
  if (entry.footprint === 'area') {
    const w = positiveDecimal(String(params.w ?? ''));
    const h = positiveDecimal(String(params.h ?? ''));
    return w !== undefined && h !== undefined ? { w, h } : undefined;
  }
  const validated = { ...params };
  for (const spec of entry.paramSpec) {
    if ('choices' in spec) continue;
    const value = numericParameter(String(params[spec.key] ?? ''), spec);
    if (value === undefined) return undefined;
    validated[spec.key] = value;
  }
  return validated;
}

export function FootprintParameters({
  entry,
  params,
  onChange,
}: {
  entry: LibraryEntry;
  params: FootprintParams;
  onChange(key: string, value: string | number): void;
}) {
  const labels = placementEt.params;
  return (
    <>
      {entry.paramSpec.map((spec) =>
        'choices' in spec ? (
          <OptionField
            key={spec.key}
            label={parameterLabel(spec.label)}
            value={params[spec.key]}
            choices={spec.choices}
            onChange={(value) => onChange(spec.key, value)}
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
            onChange={(event) => onChange(spec.key, event.target.value)}
          />
        ),
      )}
      {entry.footprint === 'area' && (
        <>
          <Field
            label={labels.width}
            inputMode="decimal"
            value={params.w}
            error={
              positiveDecimal(String(params.w ?? '')) === undefined ? labels.positive : undefined
            }
            onChange={(event) => onChange('w', event.target.value)}
          />
          <Field
            label={labels.height}
            inputMode="decimal"
            value={params.h}
            error={
              positiveDecimal(String(params.h ?? '')) === undefined ? labels.positive : undefined
            }
            onChange={(event) => onChange('h', event.target.value)}
          />
        </>
      )}
    </>
  );
}
