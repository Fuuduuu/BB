// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

test.each(['system', 'light', 'dark'] as const)(
  'loads the saved %s theme when the UI starts',
  async (theme) => {
    localStorage.setItem('pcbk.theme', theme);
    const { useViewStore } = await import('./view-store');
    expect(useViewStore.getState().theme).toBe(theme);
  },
);

test.each([null, '', 'Dark', 'blue', 'null', '{"theme":"dark"}'])(
  'uses the system theme when the stored preference is %s',
  async (stored) => {
    if (stored !== null) localStorage.setItem('pcbk.theme', stored);
    const { useViewStore } = await import('./view-store');
    expect(useViewStore.getState().theme).toBe('system');
  },
);

test('uses the system theme when browser storage access is denied', async () => {
  vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Storage denied', 'SecurityError');
  });
  const { useViewStore } = await import('./view-store');
  expect(useViewStore.getState().theme).toBe('system');
});

test('starts with the system theme when no browser storage exists', async () => {
  vi.stubGlobal('localStorage', undefined);
  try {
    const { useViewStore } = await import('./view-store');
    expect(useViewStore.getState().theme).toBe('system');
  } finally {
    vi.unstubAllGlobals();
  }
});

test('ignores storage outside the browser', async () => {
  localStorage.setItem('pcbk.theme', 'dark');
  vi.stubGlobal('window', undefined);
  try {
    const { useViewStore } = await import('./view-store');
    expect(useViewStore.getState().theme).toBe('system');
    useViewStore.getState().setTheme('light');
    expect(localStorage.getItem('pcbk.theme')).toBe('dark');
  } finally {
    vi.unstubAllGlobals();
  }
});

test('persists each chosen theme and preserves it when view state resets', async () => {
  const { useViewStore } = await import('./view-store');
  for (const theme of ['dark', 'light', 'system'] as const) {
    useViewStore.getState().setTheme(theme);
    expect(localStorage.getItem('pcbk.theme')).toBe(theme);
    useViewStore.getState().reset();
    expect(useViewStore.getState().theme).toBe(theme);
    expect(localStorage.getItem('pcbk.theme')).toBe(theme);
  }
});
