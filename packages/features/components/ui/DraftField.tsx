import { useEffect, useId, useState } from 'react';
import type { KeyboardEvent } from 'react';

/** A document field is one command per committed edit, never one per keystroke. */
export function DraftField({
  label,
  value,
  commit,
  placeholder,
  multiline = false,
  mono = false,
}: {
  label: string;
  value: string;
  commit(value: string): string | undefined;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string>();
  useEffect(() => {
    // A rejected draft stays available for correction, even when other fields change.
    if (!error) setDraft(value);
  }, [value, error]);
  const save = () => {
    if (draft === value) {
      setError(undefined);
      return;
    }
    setError(commit(draft));
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDraft(value);
      setError(undefined);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      save();
    }
  };
  const props = {
    id,
    value: draft,
    placeholder,
    className: `bb-input${mono ? ' bb-mono' : ''}`,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    onChange: (event: { target: { value: string } }) => {
      setDraft(event.target.value);
    },
    onBlur: save,
    onKeyDown: keyDown,
  };
  return (
    <div className="bb-field">
      <label className="bb-field__label" htmlFor={id}>
        {label}
      </label>
      {multiline ? <textarea {...props} rows={3} /> : <input {...props} />}
      {error && (
        <p id={`${id}-error`} className="bb-field__error">
          {error}
        </p>
      )}
    </div>
  );
}
