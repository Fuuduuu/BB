import type { ViewState } from '@pcbk/contracts';
import { create } from 'zustand';

export type Theme = 'system' | 'light' | 'dark';

interface ViewStore extends ViewState {
  contextWidth: number;
  contextOpen: boolean;
  theme: Theme;
  setNavigatorWidth(width: number): void;
  setNavigatorTab(tab: string): void;
  setContextWidth(width: number): void;
  setContextOpen(open: boolean): void;
  setTheme(theme: Theme): void;
  restore(view: ViewState | null): void;
  getView(): ViewState;
  reset(): void;
}

const defaults = {
  navigatorWidth: 300,
  navigatorTab: 'components',
  contextWidth: 340,
  contextOpen: true,
  theme: 'system' as Theme,
};

function clamp(width: number, min: number, max: number, fallback: number) {
  return Number.isFinite(width) ? Math.max(min, Math.min(max, width)) : fallback;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  ...defaults,
  setNavigatorWidth: (width) => set({ navigatorWidth: clamp(width, 240, 420, 300) }),
  setNavigatorTab: (tab) => set({ navigatorTab: tab || defaults.navigatorTab }),
  setContextWidth: (width) => set({ contextWidth: clamp(width, 280, 460, 340) }),
  setContextOpen: (contextOpen) => set({ contextOpen }),
  setTheme: (theme) => set({ theme }),
  restore: (view) =>
    set({
      navigatorWidth: clamp(view?.navigatorWidth ?? defaults.navigatorWidth, 240, 420, 300),
      navigatorTab: view?.navigatorTab || defaults.navigatorTab,
    }),
  getView: () => ({ navigatorWidth: get().navigatorWidth, navigatorTab: get().navigatorTab }),
  reset: () => set(defaults),
}));
