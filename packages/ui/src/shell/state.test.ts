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
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_1' }] });
    useSessionStore.getState().setToolId('pan');
    useSessionStore.getState().setPreview({ owner: 'test', data: { x: 10 } });
    expect(useSessionStore.getState().selection).toEqual({
      items: [{ kind: 'component', id: 'cmp_1' }],
    });
    useSessionStore.getState().reset('session_b');
    expect(useSessionStore.getState()).toMatchObject({
      sessionId: 'session_b',
      selection: { items: [] },
      toolId: 'select',
      preview: null,
    });
  });

  test('changing panels and appearance never changes the selected object', () => {
    useSessionStore
      .getState()
      .setSelection({ items: [{ kind: 'pin', componentId: 'cmp_1', id: '7' }] });
    useViewStore.getState().setNavigatorTab('log');
    useViewStore.getState().setContextOpen(false);
    useViewStore.getState().setTheme('dark');
    expect(useSessionStore.getState().selection).toEqual({
      items: [{ kind: 'pin', componentId: 'cmp_1', id: '7' }],
    });
  });
});

describe('view state', () => {
  test('starts with the specified panel sizes and clamps both resize ranges', () => {
    expect(useViewStore.getState()).toMatchObject({
      navigatorWidth: 300,
      navigatorOpen: true,
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
    useViewStore.getState().restore({
      navigatorWidth: 360,
      navigatorOpen: true,
      navigatorTab: 'log',
      contextWidth: 390,
      contextOpen: false,
      boardView: { zoom: 2, pan: { x: -4, y: 10 } },
    });
    const view = useViewStore.getState().getView();
    expect(view).toEqual({
      navigatorWidth: 360,
      navigatorOpen: true,
      navigatorTab: 'log',
      contextWidth: 390,
      contextOpen: false,
      boardView: { zoom: 2, pan: { x: -4, y: 10 } },
      modules: {},
    });
    expect(useViewStore.getState()).toMatchObject({
      theme: 'dark',
      contextWidth: 390,
      contextOpen: false,
    });
    view.navigatorWidth = 250;
    view.contextWidth = 280;
    view.boardView.pan.x = 10;
    expect(useViewStore.getState().navigatorWidth).toBe(360);
    expect(useViewStore.getState().contextWidth).toBe(390);
    expect(useViewStore.getState().boardView.pan.x).toBe(-4);
    useViewStore.getState().restore(null);
    expect(useViewStore.getState().getView()).toEqual({
      navigatorWidth: 300,
      navigatorOpen: true,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: true,
      boardView: { zoom: 1, pan: { x: 0, y: 0 } },
      modules: {},
    });
    expect(useViewStore.getState().theme).toBe('dark');
  });

  test('invalid or extreme persisted widths cannot break the layout', () => {
    useViewStore.getState().restore({
      navigatorWidth: Number.NaN,
      navigatorOpen: true,
      navigatorTab: '',
      contextWidth: Number.POSITIVE_INFINITY,
      contextOpen: true,
    });
    expect(useViewStore.getState().getView()).toEqual({
      navigatorWidth: 300,
      navigatorOpen: true,
      navigatorTab: 'components',
      contextWidth: 340,
      contextOpen: true,
      boardView: { zoom: 1, pan: { x: 0, y: 0 } },
      modules: {},
    });
    useViewStore.getState().restore({
      navigatorWidth: -100,
      navigatorOpen: true,
      navigatorTab: 'components',
      contextWidth: 1000,
      contextOpen: false,
    });
    expect(useViewStore.getState().navigatorWidth).toBe(240);
    expect(useViewStore.getState().contextWidth).toBe(460);
    expect(useViewStore.getState().contextOpen).toBe(false);
    useViewStore.getState().setContextWidth(Number.POSITIVE_INFINITY);
    expect(useViewStore.getState().contextWidth).toBe(340);
  });
});

test('module views round trip independently and are detached from callers', () => {
  const photo = { opacity: 0.4, visible: false };
  useViewStore.getState().setModuleView('photo', photo);
  useViewStore.getState().setModuleView('other', { enabled: true });
  photo.opacity = 1;
  const saved = useViewStore.getState().getView();
  expect(saved.modules).toEqual({
    photo: { opacity: 0.4, visible: false },
    other: { enabled: true },
  });
  (saved.modules.photo as { opacity: number }).opacity = 0;
  expect(useViewStore.getState().modules.photo).toEqual({ opacity: 0.4, visible: false });
  useViewStore.getState().restore(saved);
  (saved.modules.other as { enabled: boolean }).enabled = false;
  expect(useViewStore.getState().modules.other).toEqual({ enabled: true });
  useViewStore.getState().reset();
  expect(useViewStore.getState().modules).toEqual({});
});

test('fit and zoom requests are transient and restore/reset discard them', () => {
  const store = useViewStore.getState();
  store.requestFit();
  store.requestZoom(1.25);
  expect(useViewStore.getState().fitRequest).toBe(1);
  expect(useViewStore.getState().zoomRequest).toEqual({ sequence: 1, factor: 1.25 });
  const saved = store.getView();
  expect(saved).not.toHaveProperty('fitRequest');
  expect(saved).not.toHaveProperty('zoomRequest');
  store.restore(saved);
  expect(useViewStore.getState().fitRequest).toBe(0);
  expect(useViewStore.getState().zoomRequest).toEqual({ sequence: 0, factor: 1 });
  store.requestFit();
  store.reset();
  expect(useViewStore.getState().fitRequest).toBe(0);
});
