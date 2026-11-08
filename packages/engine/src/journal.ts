import type { JournalEntry } from './types';

export function createJournal() {
  let pending: JournalEntry[] = [];
  let next = 0;
  const order = new WeakMap<JournalEntry, number>();
  return {
    append(input: JournalEntry) {
      const entry = input; // The transaction seals the entry before publishing state.
      order.set(entry, next++);
      pending.push(entry);
    },
    drain(): JournalEntry[] {
      const entries = pending;
      pending = [];
      return entries;
    },
    requeue(entries: JournalEntry[]) {
      pending = [...new Set([...pending, ...entries.filter((entry) => order.has(entry))])];
      pending.sort((a, b) => order.get(a)! - order.get(b)!);
    },
  };
}
