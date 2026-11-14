// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Canvas, useSessionStore, type SceneTransform } from '@pcbk/ui';
import { photoUiFixture } from '../__tests__/ui-fixture';
import { CALIBRATE_TOOL_ID } from './CalibrateTool';
import { PHOTO_CALIBRATION_LAYER } from './CalibrationLayer';
import { useCalibrateStore } from './calibrate-store';
import { photoEt } from './i18n/et';

afterEach(() => {
  cleanup();
  useCalibrateStore.getState().reset();
  useSessionStore.getState().reset('');
});

function mount(zoom = 1, sceneTransform: SceneTransform = 'none') {
  const { engine } = photoUiFixture();
  return render(
    <Canvas
      snapshot={engine.snapshot()}
      execute={engine.execute}
      layers={[PHOTO_CALIBRATION_LAYER]}
      tools={[]}
      sceneTransform={sceneTransform}
      view={{ zoom, pan: { x: 0, y: 0 } }}
      onViewChange={() => undefined}
    />,
  );
}

function start() {
  useSessionStore.getState().setToolId(CALIBRATE_TOOL_ID);
  useCalibrateStore.getState().setA({ x: 10, y: 20 });
  useCalibrateStore.getState().setCursor({ x: 80, y: 90 });
}

test('calibration_layer_is_absent_without_active_tool_or_point_a', () => {
  const { container } = mount();
  expect(PHOTO_CALIBRATION_LAYER.hits).toBeUndefined();
  expect(PHOTO_CALIBRATION_LAYER.z).toBe(90);
  expect(container.querySelector('[data-layer="photo.calibration"]')).toBeNull();
  act(() => useSessionStore.getState().setToolId(CALIBRATE_TOOL_ID));
  expect(container.querySelector('circle')).toBeNull();
  act(() => useCalibrateStore.getState().setA({ x: 10, y: 20 }));
  expect(container.querySelector('circle')).not.toBeNull();
  act(() => useSessionStore.getState().setToolId('select'));
  expect(container.querySelector('[data-layer="photo.calibration"]')).toBeNull();
});

test.each([0.25, 1, 4])('calibration_preview_uses_fixed_screen_sizes_at_zoom_%s', (zoom) => {
  start();
  const { container } = mount(zoom);
  const layer = container.querySelector('[data-layer="photo.calibration"]')!;
  const circles = [...layer.querySelectorAll('circle')];
  expect(circles).toHaveLength(2);
  expect(circles.map((circle) => Number(circle.getAttribute('r')) * zoom)).toEqual([4, 4]);
  expect(circles.map((circle) => [circle.getAttribute('cx'), circle.getAttribute('cy')])).toEqual([
    ['10', '20'],
    ['80', '90'],
  ]);
  const line = layer.querySelector('line')!;
  expect(Number(line.getAttribute('stroke-width')) * zoom).toBe(1.5);
  expect(line.getAttribute('x1')).toBe('10');
  expect(line.getAttribute('y1')).toBe('20');
  expect(line.getAttribute('x2')).toBe('80');
  expect(line.getAttribute('y2')).toBe('90');
  for (const text of layer.querySelectorAll('text')) {
    expect(Number(text.getAttribute('font-size')) * zoom).toBe(12);
  }
  act(() => useCalibrateStore.getState().setB({ x: 100, y: 110 }));
  expect(line.getAttribute('x2')).toBe('100');
  expect(line.getAttribute('y2')).toBe('110');
  act(() => useCalibrateStore.getState().setCursor({ x: 200, y: 210 }));
  expect(line.getAttribute('x2')).toBe('100');
});

test('calibration_layer_shows_near_point_hint_until_valid_b', () => {
  start();
  const { container } = mount();
  act(() => useCalibrateStore.getState().setError(photoEt.calibration.tooShort));
  expect(container.textContent).toContain(photoEt.calibration.tooShort);
  act(() => useCalibrateStore.getState().setB({ x: 100, y: 110 }));
  expect(container.textContent).not.toContain(photoEt.calibration.tooShort);
});

type Matrix = [number, number, number, number, number, number];
function matrix(value: string | null): Matrix {
  const values = value
    ?.match(/^matrix\(([^)]+)\)$/)?.[1]
    ?.split(/[ ,]+/)
    .map(Number);
  if (values?.length !== 6) throw new Error('Expected affine SVG matrix');
  return values as Matrix;
}

test.each<SceneTransform>([
  'none',
  'rot90',
  'rot180',
  'rot270',
  'mirror',
  'mirror_rot90',
  'mirror_rot180',
  'mirror_rot270',
])('calibration_labels_and_hint_are_readable_under_%s', (transform) => {
  start();
  useCalibrateStore.getState().setError(photoEt.calibration.tooShort);
  const { container } = mount(1, transform);
  const [a, b, c, d] = matrix(container.querySelector('[data-scene]')!.getAttribute('transform'));
  const texts = [...container.querySelectorAll('text')];
  expect(texts.map((text) => text.textContent)).toEqual([
    photoEt.calibration.pointA,
    photoEt.calibration.pointB,
    photoEt.calibration.tooShort,
  ]);
  for (const text of texts) {
    const [e, f, g, h] = matrix(text.getAttribute('transform'));
    // Scene and text linear transforms must compose to a readable upright basis.
    expect(a * e + c * f).toBeCloseTo(1);
    expect(b * e + d * f).toBeCloseTo(0);
    expect(a * g + c * h).toBeCloseTo(0);
    expect(b * g + d * h).toBeCloseTo(1);
  }
});
