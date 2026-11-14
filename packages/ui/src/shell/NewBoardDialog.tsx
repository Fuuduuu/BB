import type { CreateReq } from '@pcbk/contracts';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { Field } from '../kit/Field';
import { et } from './i18n/et';
import { defaultBoardName } from './board-name';
import './project-screens.css';

export interface NewBoardDialogProps {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onClose(): void;
  onCreate(req: CreateReq): void;
}

function emptyForm() {
  const defaultName = defaultBoardName();
  return { defaultName, name: defaultName, device: '', problem: '' };
}

export function NewBoardDialog({
  open,
  busy = false,
  error,
  onClose,
  onCreate,
}: NewBoardDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const requestSent = useRef(false);
  const wasOpen = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm(emptyForm());
      setSubmitted(false);
      requestSent.current = false;
      nameRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!busy) {
      setSubmitted(false);
      requestSent.current = false;
    }
  }, [busy, error]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || busy || requestSent.current) return;
    requestSent.current = true;
    setSubmitted(true);
    const device = form.device.trim();
    const problem = form.problem.trim();
    onCreate({
      name: form.name.trim() || form.defaultName,
      ...(device ? { device } : {}),
      ...(problem ? { problem } : {}),
    });
  }

  const pending = busy || submitted;
  return (
    <Dialog open={open} title={et.project.newBoard} onClose={onClose} closeDisabled={pending}>
      <form className="pcbk-new-board" onSubmit={submit} aria-busy={pending}>
        <Field
          ref={nameRef}
          label={et.project.name}
          value={form.name}
          maxLength={120}
          disabled={pending}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Field
          label={et.project.device}
          value={form.device}
          disabled={pending}
          onChange={(event) => setForm({ ...form, device: event.target.value })}
        />
        <Field
          label={et.project.problem}
          value={form.problem}
          disabled={pending}
          onChange={(event) => setForm({ ...form, problem: event.target.value })}
        />
        {error && (
          <p className="pcbk-new-board__error" role="alert">
            {error}
          </p>
        )}
        <div className="pcbk-new-board__actions">
          <Button onClick={onClose} disabled={pending}>
            {et.common.cancel}
          </Button>
          <Button variant="primary" type="submit" busy={pending}>
            {et.project.start}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
