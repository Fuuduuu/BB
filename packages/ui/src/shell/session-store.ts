import { create } from 'zustand';

export type SelectionItem = { kind: string; id: string; componentId?: string };
export type Selection = { items: SelectionItem[] };
export type Preview = { owner: string; data: unknown };

interface SessionStore {
  sessionId: string;
  selection: Selection;
  toolId: string;
  preview: Preview | null;
  setSelection(selection: Selection): void;
  setToolId(toolId: string): void;
  setPreview(preview: Preview | null): void;
  reset(sessionId: string): void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionId: '',
  selection: { items: [] },
  toolId: 'select',
  preview: null,
  setSelection: ({ items }) => set({ selection: { items: items.map((item) => ({ ...item })) } }),
  setToolId: (toolId) => set({ toolId }),
  setPreview: (preview) => set({ preview }),
  reset: (sessionId) =>
    set({ sessionId, selection: { items: [] }, toolId: 'select', preview: null }),
}));
