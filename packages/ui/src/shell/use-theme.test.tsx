// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useTheme } from './use-theme';
import { useViewStore } from './view-store';
import { StartScreen } from './StartScreen';

function ThemeRoot() {
  useTheme();
  return <StartScreen recent={[]} onNew={() => {}} onOpen={() => {}} onRemoveRecent={() => {}} />;
}

beforeEach(() => {
  localStorage.clear();
  useViewStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  useViewStore.getState().reset();
});

test('applies the saved preference to the UI after resetting view state', () => {
  useViewStore.getState().setTheme('dark');
  useViewStore.getState().reset();
  render(<ThemeRoot />);
  expect(document.documentElement.dataset.theme).toBe('dark');
});

test('applies a theme change even when browser storage writes fail', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage denied', 'QuotaExceededError');
  });
  render(<ThemeRoot />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Välimus' }), {
    target: { value: 'dark' },
  });
  expect(useViewStore.getState().theme).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('pcbk.theme')).toBeNull();
});
