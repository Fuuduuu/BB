import type { ViewState } from './project-service';

export const DEFAULT_VIEW_STATE: Readonly<ViewState> = Object.freeze({
  navigatorWidth: 300,
  navigatorTab: 'components',
  contextWidth: 340,
  contextOpen: true,
});

/** Optional view metadata must never make an otherwise valid project unreadable. */
export function parseViewState(input: unknown): ViewState | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const {
    navigatorWidth = DEFAULT_VIEW_STATE.navigatorWidth,
    navigatorTab = DEFAULT_VIEW_STATE.navigatorTab,
    contextWidth = DEFAULT_VIEW_STATE.contextWidth,
    contextOpen = DEFAULT_VIEW_STATE.contextOpen,
  } = input as Record<string, unknown>;
  const positiveWidth = (width: unknown): width is number =>
    typeof width === 'number' && Number.isFinite(width) && width > 0;
  if (
    !positiveWidth(navigatorWidth) ||
    typeof navigatorTab !== 'string' ||
    navigatorTab.length === 0 ||
    !positiveWidth(contextWidth) ||
    typeof contextOpen !== 'boolean'
  )
    return null;
  return { navigatorWidth, navigatorTab, contextWidth, contextOpen };
}
