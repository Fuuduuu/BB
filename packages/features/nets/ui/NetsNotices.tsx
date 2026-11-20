import { useEffect, useRef, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import { Toast } from '@pcbk/ui';
import type { ToastItem } from '@pcbk/ui';
import { netsEt } from './i18n/et';

function removalMessage(payload: unknown): string | undefined {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('removedLabels' in payload) ||
    !Array.isArray(payload.removedLabels)
  ) {
    return undefined;
  }
  const labels: unknown[] = payload.removedLabels;
  if (labels.length > 1) return netsEt.removedLabels(labels.length);
  const [label] = labels;
  if (typeof label !== 'object' || label === null) return undefined;
  const name = 'name' in label && typeof label.name === 'string' ? label.name.trim() : undefined;
  return netsEt.removedLabel(name);
}

function SessionNotices({ sessionId }: { sessionId: string }) {
  const engine = useEngine();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  useEffect(
    () =>
      engine.events((event) => {
        if (event.type !== 'rules.report' || event.sessionId !== sessionId) return;
        const message = removalMessage(event.payload);
        if (message === undefined) return;
        const id = String(nextId.current++);
        setItems((current) => [...current, { id, message }]);
      }),
    [engine, sessionId],
  );
  return (
    <Toast
      items={items}
      onDismiss={(id) => setItems((current) => current.filter((item) => item.id !== id))}
    />
  );
}

export function NetsNotices() {
  const sessionId = useSnapshot((snapshot) => snapshot.sessionId);
  return <SessionNotices key={sessionId} sessionId={sessionId} />;
}
