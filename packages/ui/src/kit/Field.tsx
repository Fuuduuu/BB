import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, id, className = '', 'aria-describedby': describedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const description = [describedBy, hint && hintId, error && errorId].filter(Boolean).join(' ');
  return (
    <div className="bb-field">
      <label htmlFor={inputId} className="bb-field__label">
        {label}
      </label>
      <input
        {...props}
        ref={ref}
        id={inputId}
        className={`bb-input ${className}`}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={description || undefined}
      />
      {hint && (
        <p id={hintId} className="bb-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="bb-field__error">
          {error}
        </p>
      )}
    </div>
  );
});
