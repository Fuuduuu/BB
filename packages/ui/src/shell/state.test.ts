import { beforeEach, describe, expect, test } from 'vitest';
import { useSessionStore } from './session-store';
import { useViewStore } from './view-store';

beforeEach(() => {
  useSessionStore.getState().reset('');
  useViewStore.getState().reset();
});

describe('session state', () => {
  test('selection belongs to the session and resets when another project is activated', () => {
    useSessionStore.getState().reset('session_a');
    useSessionStore.getState().setSelection({ kind: 'component', id: 'cmp_1' });
    expect(useSessionStore.getState().selection).toEqual({ kind: 'component', id: 'cmp_1' });
    useSessionStore.getState().reset('session_b');
    expect(useSessionStore.getState().sessionId).toBe('session_b');
    expect(useSessionStore.getState().selection).toEqual({ kind: 'none' });
  });

  test('changing panels and appearance never changes the selected object', () => {
    useSessionStore.getState().setSelection({ kind: 'pin', componentId: 'cmp_1', pinId: '7' });
    useViewStore.getState().setNavigatorTab('log');
    useViewStore.getState().setContextOpen(false);
    useViewStore.getState().setTheme('dark');
    expect(useSessionStore.getState().selection).toEqual({
      kind: 'pin',
      componentId: 'cmp_1',
      pinId: '7',
    });
  });
});

describe('view state', () => {
  test('starts with the specified panel sizes and clamps both resize ranges', () => {
    expect(useViewStore.getState()).toMatchObject({
      navigatorWidth: 300,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: true,
      theme: 'system',
    });
    useViewStore.getState().setNavigatorWidth(20);
    useViewStore.getState().setContextWidth(1000);
    expect(useViewStore.getState().navigatorWidth).toBe(240);
    expect(useViewStore.getState().contextWidth).toBe(460);
    useViewStore.getState().setNavigatorWidth(999);
    useViewStore.getState().setContextWidth(20);
    expect(useViewStore.getState().navigatorWidth).toBe(420);
    expect(useViewStore.getState().contextWidth).toBe(280);
  });

  test('restores only the persisted contract fields and returns a detached view', () => {
    useViewStore.getState().setTheme('dark');
    useViewStore.getState().setContextOpen(false);
    useViewStore.getState().restore({ navigatorWidth: 360, navigatorTab: 'log' });
    const view = useViewStore.getState().getView();
    expect(view).toEqual({ navigatorWidth: 360, navigatorTab: 'log' });
    expect(useViewStore.getState()).toMatchObject({ theme: 'dark', contextOpen: false });
    view.navigatorWidth = 250;
    expect(useViewStore.getState().navigatorWidth).toBe(360);
    useViewStore.getState().restore(null);
    expect(useViewStore.getState().getView()).toEqual({
      navigatorWidth: 300,
      navigatorTab: 'components',
    });
  });

  test('invalid or extreme persisted widths cannot break the layout', () => {
    useViewStore.getState().restore({ navigatorWidth: Number.NaN, navigatorTab: '' });
    expect(useViewStore.getState().getView()).toEqual({
      navigatorWidth: 300,
      navigatorTab: 'components',
    });
    useViewStore.getState().restore({ navigatorWidth: -100, navigatorTab: 'components' });
    expect(useViewStore.getState().navigatorWidth).toBe(240);
    useViewStore.getState().setContextWidth(Number.POSITIVE_INFINITY);
    expect(useViewStore.getState().contextWidth).toBe(340);
  });
});
