import { HISTORY_LIMIT } from '@pcbk/domain';
import type { Patch } from 'immer';

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
