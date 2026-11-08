import { create } from 'zustand';

export type Selection =
  | { kind: 'none' }
  | { kind: 'component'; id: string }
  | { kind: 'pin'; componentId: string; pinId: string }
  | { kind: 'connection' | 'net' | 'measurement'; id: string };
export type SelectionKind = Selection['kind'];

interface SessionStore {
  sessionId: string;
  selection: Selection;
  setSelection(selection: Selection): void;
  reset(sessionId: string): void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionId: '',
  selection: { kind: 'none' },
  setSelection: (selection) => set({ selection: { ...selection } }),
  reset: (sessionId) => set({ sessionId, selection: { kind: 'none' } }),
}));
