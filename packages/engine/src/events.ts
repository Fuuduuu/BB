import { current, isDraft } from 'immer';
import { sealTree } from './immutability';

export function capturePayload(value: unknown, ancestors = new Set<object>()): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  )
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object') throw new Error('invalid_event_payload');
  const source: object = isDraft(value) ? current(value) : value;
  if (ancestors.has(source)) throw new Error('cyclic_event_payload');
  const prototype = Object.getPrototypeOf(source);
  if (!Array.isArray(source) && prototype !== Object.prototype && prototype !== null)
    throw new Error('invalid_event_payload');
  if (Object.getOwnPropertySymbols(source).length) throw new Error('invalid_event_payload');
  ancestors.add(source);
  const result: unknown = Array.isArray(source)
    ? source.map((item) => capturePayload(item, ancestors))
    : Object.fromEntries(
        Object.entries(source).map(([key, item]) => [key, capturePayload(item, ancestors)]),
      );
  ancestors.delete(source);
  return sealTree(result);
}

export function notify<T>(listeners: Set<(value: T) => void>, value: T): void {
  for (const listener of [...listeners]) {
    try {
      const returned: unknown = listener(value);
      if (
        returned !== null &&
        (typeof returned === 'object' || typeof returned === 'function') &&
        'then' in returned
      ) {
        void Promise.resolve(returned).catch(() => undefined);
      }
    } catch {
      /* An observer cannot roll back a confirmed transaction or block other observers. */
    }
  }
}
