import { useId } from 'react';
import type { ComponentKind } from '@pcbk/domain';
import { et } from '@pcbk/ui';

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
        {et.component.type}
      </label>
      <select
        id={id}
        className="bb-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ComponentKind)}
      >
        {(Object.keys(et.component.kinds) as ComponentKind[]).map((kind) => (
          <option key={kind} value={kind}>
            {et.component.kinds[kind]}
          </option>
        ))}
      </select>
    </div>
  );
}
