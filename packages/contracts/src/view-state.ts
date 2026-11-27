import type { BoardView, ViewState } from './project-service';

export const DEFAULT_VIEW_STATE: Readonly<Required<Omit<ViewState, 'schematicView'>>> =
  Object.freeze({
    navigatorWidth: 300,
    navigatorOpen: true,
    navigatorTab: 'components',
    contextWidth: 340,
    contextOpen: true,
    boardView: Object.freeze({ zoom: 1, pan: Object.freeze({ x: 0, y: 0 }) }),
    modules: Object.freeze({}),
  });

function viewJson(view: ViewState): string {
  return JSON.stringify(view, (_key: string, value: unknown) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  });
}

/** Compare the persisted JSON value, including opaque module settings and future fields. */
export function sameViewState(a: ViewState, b: ViewState): boolean {
  return viewJson(a) === viewJson(b);
}

function record(input: unknown): Record<string, unknown> | undefined {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function parseBoardView(input: unknown): BoardView | undefined {
  const view = record(input);
  const pan = record(view?.pan);
  if (positive(view?.zoom) && finite(pan?.x) && finite(pan.y)) {
    return { zoom: view.zoom, pan: { x: pan.x, y: pan.y } };
  }
}

export function normalizeBoardView(input: unknown): BoardView {
  const view = parseBoardView(input);
  if (view) return view;
  const { zoom, pan: defaultPan } = DEFAULT_VIEW_STATE.boardView;
  return { zoom, pan: { ...defaultPan } };
}

/** Optional view metadata must never make an otherwise valid project unreadable. */
export function parseViewState(
  input: unknown,
): (ViewState & Required<Pick<ViewState, 'boardView' | 'modules'>>) | null {
  const view = record(input);
  if (!view) return null;
  const {
    navigatorWidth = DEFAULT_VIEW_STATE.navigatorWidth,
    navigatorTab = DEFAULT_VIEW_STATE.navigatorTab,
    contextWidth = DEFAULT_VIEW_STATE.contextWidth,
    contextOpen = DEFAULT_VIEW_STATE.contextOpen,
    boardView,
  } = view;
  if (
    !positive(navigatorWidth) ||
    typeof navigatorTab !== 'string' ||
    navigatorTab.length === 0 ||
    !positive(contextWidth) ||
    typeof contextOpen !== 'boolean'
  )
    return null;
  const schematicView = parseBoardView(view.schematicView);
  return {
    navigatorWidth,
    navigatorOpen:
      typeof view.navigatorOpen === 'boolean'
        ? view.navigatorOpen
        : DEFAULT_VIEW_STATE.navigatorOpen,
    navigatorTab,
    contextWidth,
    contextOpen,
    boardView: normalizeBoardView(boardView),
    ...(schematicView && { schematicView }),
    modules: JSON.parse(JSON.stringify(record(view.modules) ?? {})) as Record<string, unknown>,
  };
}
