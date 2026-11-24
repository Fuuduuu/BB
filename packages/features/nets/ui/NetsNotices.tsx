import { useEffect, useRef, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import { Toast } from '@pcbk/ui';
import type { ToastItem } from '@pcbk/ui';
import { netsEt } from './i18n/et';

function labelRemovalMessage(labels: unknown): string | undefined {
  if (!Array.isArray(labels)) return undefined;
  if (labels.length > 1) return netsEt.removedLabels(labels.length);
  const [label]: unknown[] = labels;
  if (typeof label !== 'object' || label === null) return undefined;
  const name = 'name' in label && typeof label.name === 'string' ? label.name.trim() : undefined;
  return netsEt.removedLabel(name);
}

function removalMessages(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const labels =
    'removedLabels' in payload ? labelRemovalMessage(payload.removedLabels) : undefined;
  const count = 'removedConnections' in payload ? payload.removedConnections : undefined;
  const connections =
    typeof count === 'number' && Number.isInteger(count) && count > 0
      ? netsEt.removedConnections(count)
      : undefined;
  return [labels, connections].filter((message): message is string => message !== undefined);
}

function SessionNotices({ sessionId }: { sessionId: string }) {
  const engine = useEngine();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  useEffect(
    () =>
      engine.events((event) => {
        if (event.type !== 'rules.report' || event.sessionId !== sessionId) return;
        const messages = removalMessages(event.payload);
        if (messages.length === 0) return;
        const notices = messages.map((message) => ({ id: String(nextId.current++), message }));
        setItems((current) => [...current, ...notices]);
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
