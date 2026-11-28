import { DEFAULT_VIEW_STATE, normalizeBoardView } from '@pcbk/contracts';
import type { BoardView, ViewState } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { create } from 'zustand';
import { readStoredTheme, saveStoredTheme } from './theme-storage';
import type { Theme } from './theme-storage';

export type { Theme } from './theme-storage';

type ActiveView = 'board' | 'schematic';
type RevealRequest = { view: ActiveView; at: Vec2 };

interface ViewStore extends Required<Omit<ViewState, 'schematicView'>> {
  activeView: ActiveView;
  schematicView: BoardView | null;
  theme: Theme;
  contextShown: boolean;
  fitRequest: number;
  revealRequest: RevealRequest | null;
  zoomRequest: { sequence: number; factor: number };
  requestFit(): void;
  requestReveal(view: ActiveView, at: Vec2): void;
  requestZoom(factor: number): void;
  setModuleView(id: string, value: unknown): void;
  setNavigatorWidth(width: number): void;
  setNavigatorOpen(open: boolean): void;
  setNavigatorTab(tab: string): void;
  setContextWidth(width: number): void;
  setContextOpen(open: boolean): void;
  setContextShown(shown: boolean): void;
  setBoardView(view: BoardView): void;
  setActiveView(view: ActiveView): void;
  toggleView(): void;
  setSchematicView(view: BoardView): void;
  setTheme(theme: Theme): void;
  restore(view: ViewState | null): void;
  getView(): ViewState & Required<Pick<ViewState, 'boardView' | 'modules'>>;
  reset(): void;
}

function clamp(width: number, min: number, max: number, fallback: number) {
  return Number.isFinite(width) ? Math.max(min, Math.min(max, width)) : fallback;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  ...DEFAULT_VIEW_STATE,
  boardView: normalizeBoardView(undefined),
  schematicView: null,
  activeView: 'board',
  modules: {},
  contextShown: false,
  fitRequest: 0,
  revealRequest: null,
  zoomRequest: { sequence: 0, factor: 1 },
  requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),
  requestReveal: (view, at) => set({ revealRequest: { view, at: { ...at } } }),
  requestZoom: (factor) => {
    if (Number.isFinite(factor) && factor > 0)
      set((state) => ({ zoomRequest: { sequence: state.zoomRequest.sequence + 1, factor } }));
  },
  theme: readStoredTheme(),
  setNavigatorWidth: (width) =>
    set({ navigatorWidth: clamp(width, 240, 420, DEFAULT_VIEW_STATE.navigatorWidth) }),
  setNavigatorOpen: (navigatorOpen) => set({ navigatorOpen }),
  setNavigatorTab: (tab) => set({ navigatorTab: tab || DEFAULT_VIEW_STATE.navigatorTab }),
  setContextWidth: (width) =>
    set({ contextWidth: clamp(width, 280, 460, DEFAULT_VIEW_STATE.contextWidth) }),
  setContextOpen: (contextOpen) => set({ contextOpen }),
  setContextShown: (contextShown) => set({ contextShown }),
  setBoardView: (boardView) => set({ boardView: normalizeBoardView(boardView) }),
  setActiveView: (activeView) => set({ activeView }),
  toggleView: () =>
    set((state) => ({ activeView: state.activeView === 'board' ? 'schematic' : 'board' })),
  setSchematicView: (schematicView) => set({ schematicView: normalizeBoardView(schematicView) }),
  setModuleView: (id, value) =>
    set((state) => ({ modules: { ...state.modules, [id]: structuredClone(value) } })),
  setTheme: (theme) => {
    set({ theme });
    saveStoredTheme(theme);
  },
  restore: (view) =>
    set({
      fitRequest: 0,
      revealRequest: null,
      zoomRequest: { sequence: 0, factor: 1 },
      contextShown: false,
      navigatorWidth: clamp(
        view?.navigatorWidth ?? DEFAULT_VIEW_STATE.navigatorWidth,
        240,
        420,
        DEFAULT_VIEW_STATE.navigatorWidth,
      ),
      navigatorTab: view?.navigatorTab || DEFAULT_VIEW_STATE.navigatorTab,
      navigatorOpen: view?.navigatorOpen ?? DEFAULT_VIEW_STATE.navigatorOpen,
      contextWidth: clamp(
        view?.contextWidth ?? DEFAULT_VIEW_STATE.contextWidth,
        280,
        460,
        DEFAULT_VIEW_STATE.contextWidth,
      ),
      contextOpen: view?.contextOpen ?? DEFAULT_VIEW_STATE.contextOpen,
      boardView: normalizeBoardView(view?.boardView),
      schematicView: view?.schematicView ? normalizeBoardView(view.schematicView) : null,
      activeView: 'board',
      modules: structuredClone(view?.modules ?? {}),
    }),
  getView: () => {
    const state = get();
    return {
      navigatorWidth: state.navigatorWidth,
      navigatorOpen: state.navigatorOpen,
      navigatorTab: state.navigatorTab,
      contextWidth: state.contextWidth,
      contextOpen: state.contextOpen,
      boardView: normalizeBoardView(state.boardView),
      ...(state.schematicView && { schematicView: normalizeBoardView(state.schematicView) }),
      modules: structuredClone(state.modules),
    };
  },
  reset: () =>
    set({
      ...DEFAULT_VIEW_STATE,
      schematicView: null,
      activeView: 'board',
      modules: {},
      contextShown: false,
      fitRequest: 0,
      revealRequest: null,
      zoomRequest: { sequence: 0, factor: 1 },
      boardView: normalizeBoardView(undefined),
      theme: readStoredTheme(),
    }),
}));
