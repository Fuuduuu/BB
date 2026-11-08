import { useEffect } from 'react';
import { useViewStore } from './view-store';

/** Mount once at the active UI root so the preference also covers the start screen. */
export function useTheme(enabled = true) {
  const theme = useViewStore((state) => state.theme);
  useEffect(() => {
    if (!enabled) return;
    const previous = document.documentElement.getAttribute('data-theme');
    document.documentElement.dataset.theme = theme;
    return () => {
      if (previous === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.dataset.theme = previous;
    };
  }, [enabled, theme]);
}
