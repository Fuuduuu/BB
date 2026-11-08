import { HISTORY_LIMIT } from '@pcbk/domain';
import type { Snapshot } from '@pcbk/contracts';
import type { Patch } from 'immer';
import type { JournalEntry } from './types';

export type HistoryEntry = {
  patches: Patch[];
  inversePatches: Patch[];
  commandId: string;
  summary: string;
};
export function createHistory() {
  const past: HistoryEntry[] = [];
  const future: HistoryEntry[] = [];
  return {
    status: (): Snapshot['history'] => ({ canUndo: past.length > 0, canRedo: future.length > 0 }),
    projectedStatus(kind: JournalEntry['kind']): Snapshot['history'] {
      if (kind === 'command') return { canUndo: true, canRedo: false };
      if (kind === 'undo') {
        return { canUndo: past.length > 1, canRedo: future.length > 0 || past.length > 0 };
      }
      return { canUndo: past.length > 0 || future.length > 0, canRedo: future.length > 1 };
    },
    undoEntry: () => past.at(-1),
    redoEntry: () => future.at(-1),
    record(entry: HistoryEntry) {
      past.push(entry);
      future.length = 0;
      if (past.length > HISTORY_LIMIT) past.shift();
    },
    didUndo() {
      const entry = past.pop();
      if (entry) future.push(entry);
    },
    didRedo() {
      const entry = future.pop();
      if (entry) past.push(entry);
    },
  };
}
