import { create } from 'zustand';

interface HoverStore {
  componentId: string | null;
  setComponentId(componentId: string | null): void;
  clear(componentId: string): void;
}

export const useHoverStore = create<HoverStore>((set) => ({
  componentId: null,
  setComponentId: (componentId) => set({ componentId }),
  clear: (componentId) =>
    set((state) => (state.componentId === componentId ? { componentId: null } : state)),
}));
