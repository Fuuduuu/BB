export type Theme = 'system' | 'light' | 'dark';

const storageKey = 'pcbk.theme';

export function readStoredTheme(): Theme {
  if (typeof globalThis.window === 'undefined') return 'system';
  try {
    const theme = globalThis.localStorage?.getItem(storageKey);
    return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
  } catch {
    return 'system';
  }
}

export function saveStoredTheme(theme: Theme): void {
  if (typeof globalThis.window === 'undefined') return;
  try {
    globalThis.localStorage?.setItem(storageKey, theme);
  } catch {
    // A denied browser preference write must not block the active UI choice.
  }
}
