import { beforeEach, expect, test } from 'vitest';
import { parseViewState } from '@pcbk/contracts';
import { useViewStore } from './view-store';

beforeEach(() => useViewStore.getState().reset());

test('navigator visibility round trip preserves stored width', () => {
  const store = useViewStore.getState();
  store.setNavigatorWidth(395);
  store.setNavigatorOpen(false);
  expect(store.getView()).toMatchObject({ navigatorOpen: false, navigatorWidth: 395 });
  const saved = store.getView();
  store.restore(null);
  expect(store.getView()).toMatchObject({ navigatorOpen: true, navigatorWidth: 300 });
  store.restore(saved);
  expect(store.getView()).toMatchObject({ navigatorOpen: false, navigatorWidth: 395 });
  store.setNavigatorOpen(true);
  expect(store.getView()).toMatchObject({ navigatorOpen: true, navigatorWidth: 395 });
});

test('old view restore opens navigator and resets transient context visibility', () => {
  const store = useViewStore.getState();
  store.setNavigatorOpen(false);
  store.setContextShown(true);
  store.restore(parseViewState({ navigatorWidth: 375 }));
  expect(useViewStore.getState()).toMatchObject({
    navigatorOpen: true,
    navigatorWidth: 375,
    contextShown: false,
  });
});

test('computed context visibility is transient and does not change saved panel preference', () => {
  const store = useViewStore.getState();
  expect(useViewStore.getState().contextShown).toBe(false);
  store.setContextOpen(false);
  store.setContextShown(true);
  expect(useViewStore.getState().contextShown).toBe(true);
  expect(store.getView().contextOpen).toBe(false);
  expect(store.getView()).not.toHaveProperty('contextShown');
  store.setContextShown(false);
  expect(useViewStore.getState().contextShown).toBe(false);
  store.setContextShown(true);
  store.restore(store.getView());
  expect(useViewStore.getState().contextShown).toBe(false);
});

test('reset restores navigator preference and clears computed context visibility', () => {
  const store = useViewStore.getState();
  store.setNavigatorOpen(false);
  store.setContextShown(true);
  store.reset();
  expect(useViewStore.getState()).toMatchObject({ navigatorOpen: true, contextShown: false });
  store.setContextShown(true);
  store.restore(null);
  expect(useViewStore.getState().contextShown).toBe(false);
});
