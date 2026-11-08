import { expect, test } from 'vitest';
import { parseViewState } from './view-state';

test.each([
  {
    raw: {},
    expected: {
      navigatorWidth: 300,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: true,
    },
  },
  {
    raw: { navigatorWidth: 700, navigatorTab: 'log' },
    expected: { navigatorWidth: 700, navigatorTab: 'log', contextWidth: 340, contextOpen: true },
  },
  {
    raw: {
      navigatorWidth: 1,
      navigatorTab: 'future',
      contextWidth: 9000,
      contextOpen: false,
      theme: 'dark',
    },
    expected: { navigatorWidth: 1, navigatorTab: 'future', contextWidth: 9000, contextOpen: false },
  },
])('normalizes optional view fields and strips unrelated values: %j', ({ raw, expected }) => {
  expect(parseViewState(raw)).toEqual(expected);
});

test.each(
  [
    undefined,
    null,
    [],
    1,
    'view',
    { navigatorWidth: null },
    { navigatorWidth: 0 },
    { navigatorWidth: -1 },
    { navigatorWidth: NaN },
    { navigatorWidth: Infinity },
    { navigatorWidth: -Infinity },
    { navigatorTab: null },
    { navigatorTab: '' },
    { navigatorTab: 4 },
    { contextWidth: null },
    { contextWidth: 0 },
    { contextWidth: -1 },
    { contextWidth: NaN },
    { contextWidth: Infinity },
    { contextWidth: -Infinity },
    { contextWidth: '340' },
    { contextOpen: null },
    { contextOpen: 0 },
    { contextOpen: 'false' },
  ].map((raw) => ({ raw })),
)('ignores an invalid optional view: %j', ({ raw }) => {
  expect(parseViewState(raw)).toBeNull();
});

test('normalization returns a detached value without modifying the caller or shared defaults', () => {
  const raw = { navigatorWidth: 420, navigatorTab: 'log', contextWidth: 450, contextOpen: false };
  const parsed = parseViewState(raw)!;
  parsed.navigatorWidth = 900;
  expect(raw.navigatorWidth).toBe(420);
  const defaults = parseViewState({})!;
  defaults.contextWidth = 900;
  expect(parseViewState({})!.contextWidth).toBe(340);
});
