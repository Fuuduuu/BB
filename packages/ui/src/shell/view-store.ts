import { DEFAULT_VIEW_STATE } from '@pcbk/contracts';
import type { ViewState } from '@pcbk/contracts';
import { create } from 'zustand';
import { readStoredTheme, saveStoredTheme } from './theme-storage';
import type { Theme } from './theme-storage';

export type { Theme } from './theme-storage';

interface ViewStore extends ViewState {
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

function clamp(width: number, min: number, max: number, fallback: number) {
  return Number.isFinite(width) ? Math.max(min, Math.min(max, width)) : fallback;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  ...DEFAULT_VIEW_STATE,
  theme: readStoredTheme(),
  setNavigatorWidth: (width) =>
    set({ navigatorWidth: clamp(width, 240, 420, DEFAULT_VIEW_STATE.navigatorWidth) }),
  setNavigatorTab: (tab) => set({ navigatorTab: tab || DEFAULT_VIEW_STATE.navigatorTab }),
  setContextWidth: (width) =>
    set({ contextWidth: clamp(width, 280, 460, DEFAULT_VIEW_STATE.contextWidth) }),
  setContextOpen: (contextOpen) => set({ contextOpen }),
  setTheme: (theme) => {
    set({ theme });
    saveStoredTheme(theme);
  },
  restore: (view) =>
    set({
      navigatorWidth: clamp(
        view?.navigatorWidth ?? DEFAULT_VIEW_STATE.navigatorWidth,
        240,
        420,
        DEFAULT_VIEW_STATE.navigatorWidth,
      ),
      navigatorTab: view?.navigatorTab || DEFAULT_VIEW_STATE.navigatorTab,
      contextWidth: clamp(
        view?.contextWidth ?? DEFAULT_VIEW_STATE.contextWidth,
        280,
        460,
        DEFAULT_VIEW_STATE.contextWidth,
      ),
      contextOpen: view?.contextOpen ?? DEFAULT_VIEW_STATE.contextOpen,
    }),
  getView: () => ({
    navigatorWidth: get().navigatorWidth,
    navigatorTab: get().navigatorTab,
    contextWidth: get().contextWidth,
    contextOpen: get().contextOpen,
  }),
  reset: () => set({ ...DEFAULT_VIEW_STATE, theme: readStoredTheme() }),
}));
