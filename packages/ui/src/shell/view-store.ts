import { DEFAULT_VIEW_STATE, normalizeBoardView } from '@pcbk/contracts';
import type { BoardView, ViewState } from '@pcbk/contracts';
import { create } from 'zustand';
import { readStoredTheme, saveStoredTheme } from './theme-storage';
import type { Theme } from './theme-storage';

export type { Theme } from './theme-storage';

interface ViewStore extends Required<ViewState> {
  theme: Theme;
  fitRequest: number;
  zoomRequest: { sequence: number; factor: number };
  requestFit(): void;
  requestZoom(factor: number): void;
  setModuleView(id: string, value: unknown): void;
  setNavigatorWidth(width: number): void;
  setNavigatorTab(tab: string): void;
  setContextWidth(width: number): void;
  setContextOpen(open: boolean): void;
  setBoardView(view: BoardView): void;
  setTheme(theme: Theme): void;
  restore(view: ViewState | null): void;
  getView(): Required<ViewState>;
  reset(): void;
}

function clamp(width: number, min: number, max: number, fallback: number) {
  return Number.isFinite(width) ? Math.max(min, Math.min(max, width)) : fallback;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  ...DEFAULT_VIEW_STATE,
  boardView: normalizeBoardView(undefined),
  modules: {},
  fitRequest: 0,
  zoomRequest: { sequence: 0, factor: 1 },
  requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),
  requestZoom: (factor) => {
    if (Number.isFinite(factor) && factor > 0)
      set((state) => ({ zoomRequest: { sequence: state.zoomRequest.sequence + 1, factor } }));
  },
  theme: readStoredTheme(),
  setNavigatorWidth: (width) =>
    set({ navigatorWidth: clamp(width, 240, 420, DEFAULT_VIEW_STATE.navigatorWidth) }),
  setNavigatorTab: (tab) => set({ navigatorTab: tab || DEFAULT_VIEW_STATE.navigatorTab }),
  setContextWidth: (width) =>
    set({ contextWidth: clamp(width, 280, 460, DEFAULT_VIEW_STATE.contextWidth) }),
  setContextOpen: (contextOpen) => set({ contextOpen }),
  setBoardView: (boardView) => set({ boardView: normalizeBoardView(boardView) }),
  setModuleView: (id, value) =>
    set((state) => ({ modules: { ...state.modules, [id]: structuredClone(value) } })),
  setTheme: (theme) => {
    set({ theme });
    saveStoredTheme(theme);
  },
  restore: (view) =>
    set({
      fitRequest: 0,
      zoomRequest: { sequence: 0, factor: 1 },
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
      boardView: normalizeBoardView(view?.boardView),
      modules: structuredClone(view?.modules ?? {}),
    }),
  getView: () => ({
    navigatorWidth: get().navigatorWidth,
    navigatorTab: get().navigatorTab,
    contextWidth: get().contextWidth,
    contextOpen: get().contextOpen,
    boardView: normalizeBoardView(get().boardView),
    modules: structuredClone(get().modules),
  }),
  reset: () =>
    set({
      ...DEFAULT_VIEW_STATE,
      modules: {},
      fitRequest: 0,
      zoomRequest: { sequence: 0, factor: 1 },
      boardView: normalizeBoardView(undefined),
      theme: readStoredTheme(),
    }),
}));
