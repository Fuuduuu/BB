import { componentEt } from './i18n/et';
import { useId } from 'react';
import type { ComponentKind } from '@pcbk/domain';

export function KindField({
  value,
  onChange,
  disabled = false,
}: {
  value: ComponentKind;
  onChange(kind: ComponentKind): void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="bb-field">
      <label className="bb-field__label" htmlFor={id}>
        {componentEt.type}
      </label>
      <select
        id={id}
        className="bb-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ComponentKind)}
      >
        {(Object.keys(componentEt.kinds) as ComponentKind[]).map((kind) => (
          <option key={kind} value={kind}>
            {componentEt.kinds[kind]}
          </option>
        ))}
      </select>
    </div>
  );
}
