import { useSyncExternalStore } from 'react';

const wideQuery = '(min-width: 1280px)';
function subscribeWidth(notify: () => void) {
  const media = window.matchMedia?.(wideQuery);
  media?.addEventListener('change', notify);
  return () => media?.removeEventListener('change', notify);
}
const isWide = () => window.matchMedia?.(wideQuery).matches ?? true;

/** Shared with the shell's side-by-side versus overlay context-pane layout. */
export function useWideLayout() {
  return useSyncExternalStore(subscribeWidth, isWide, () => true);
}
