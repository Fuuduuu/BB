import { useEffect, useId, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { et } from '../shell/i18n/et';
import { Button } from './Button';
import { CloseIcon } from './CloseIcon';

export type DialogProps = PropsWithChildren<{
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
}>;

export function Dialog({
  open,
  title,
  onClose,
  closeLabel = et.common.close,
  children,
  className = '',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      className={`bb-dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="bb-dialog__header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label={closeLabel}>
          <CloseIcon />
        </Button>
      </header>
      <div className="bb-dialog__body">{children}</div>
    </dialog>
  );
}
