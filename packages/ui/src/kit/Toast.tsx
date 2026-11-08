import { useEffect, useRef } from 'react';
import { et } from '../shell/i18n/et';
import { Button } from './Button';
import { CloseIcon } from './CloseIcon';

export interface ToastItem {
  id: string;
  message: string;
  tone?: 'info' | 'success' | 'error';
}
export interface ToastProps {
  items: readonly ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastMessage({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: ToastProps['onDismiss'];
}) {
  const latestDismiss = useRef(onDismiss);
  useEffect(() => {
    latestDismiss.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(() => latestDismiss.current(item.id), 2500);
    return () => clearTimeout(timer);
  }, [item.id]);
  return (
    <div
      className={`bb-toast bb-toast--${item.tone ?? 'info'}`}
      role={item.tone === 'error' ? 'alert' : 'status'}
    >
      <span>{item.message}</span>
      <Button variant="ghost" aria-label={et.common.dismiss} onClick={() => onDismiss(item.id)}>
        <CloseIcon />
      </Button>
    </div>
  );
}

export function Toast({ items, onDismiss }: ToastProps) {
  useEffect(() => {
    for (const item of items.slice(0, -3)) onDismiss(item.id);
  }, [items, onDismiss]);
  return (
    <div className="bb-toast-viewport">
      {items.slice(-3).map((item) => (
        <ToastMessage key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
