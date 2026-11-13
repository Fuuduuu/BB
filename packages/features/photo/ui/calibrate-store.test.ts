import { afterEach, expect, test } from 'vitest';
import { useCalibrateStore } from './calibrate-store';

afterEach(() => useCalibrateStore.getState().reset());

test('calibration_store_detaches_selected_points_and_resets_draft', () => {
  const a = { x: 10, y: 20 };
  const b = { x: 30, y: 40 };
  const cursor = { x: 50, y: 60 };
  const store = useCalibrateStore.getState();
  store.setA(a);
  store.setB(b);
  store.setCursor(cursor);
  store.setError('failure');
  a.x = b.x = cursor.x = -1;
  expect(useCalibrateStore.getState()).toMatchObject({
    a: { x: 10, y: 20 },
    b: { x: 30, y: 40 },
    cursor: { x: 50, y: 60 },
    dialogOpen: true,
    error: 'failure',
  });
  store.setA({ x: 70, y: 80 });
  expect(useCalibrateStore.getState()).toMatchObject({
    a: { x: 70, y: 80 },
    b: null,
    cursor: { x: 70, y: 80 },
    dialogOpen: false,
    error: null,
  });
  store.reset();
  expect(useCalibrateStore.getState()).toMatchObject({
    a: null,
    b: null,
    cursor: null,
    dialogOpen: false,
    error: null,
  });
});

test('calibration_store_allows_dialog_to_display_engine_rejections', () => {
  const store = useCalibrateStore.getState();
  store.setA({ x: 1, y: 1 });
  store.setError('old error');
  store.setB({ x: 1, y: 1 });
  expect(useCalibrateStore.getState()).toMatchObject({
    b: { x: 1, y: 1 },
    cursor: { x: 1, y: 1 },
    dialogOpen: true,
    error: null,
  });
});
