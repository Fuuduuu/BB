// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import { Canvas, useSessionStore } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
import { mountPlaceTool } from '../__tests__/place-tool-helpers';
import type { PlacePreviewData } from '../PlaceTool';
import { PLACE_TOOL_ID, usePlaceStore } from '../place-store';
import { COMPONENTS_LAYERS } from './index';

const soic: PlacePreviewData = {
  footprint: 'soic',
  params: { pins: 8, body: 3.9 },
  center: { x: 100, y: 80 },
};

function mount(data = soic, zoom = 1, sceneTransform: SceneTransform = 'none') {
  const doc = newBoardDoc('Paigutuse kummitus');
  doc.scale.pxPerMm = 10;
  const { engine } = setup(doc);
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  const result = render(
    <Canvas
      layers={COMPONENTS_LAYERS}
      tools={[]}
      snapshot={engine.snapshot()}
      execute={engine.execute}
      sceneTransform={sceneTransform}
      view={{ zoom, pan: { x: 0, y: 0 } }}
      onViewChange={() => {}}
    />,
  );
  const preview = (next: PlacePreviewData | null) =>
    act(() => useSessionStore.getState().setPreview(next && { owner: PLACE_TOOL_ID, data: next }));
  preview(data);
  return {
    ...result,
    engine,
    preview,
    ghost: () => result.container.querySelector('[data-placement-ghost]'),
  };
}

function number(element: Element | null, name: string) {
  expect(element).toBeTruthy();
  return Number(element!.getAttribute(name));
}

function pad(container: Element | null, id = '1') {
  const result = container?.querySelector(`[data-pad="${id}"] > *`);
  expect(result).toBeTruthy();
  return result!;
}

function rectCenter(element: Element) {
  return {
    x: number(element, 'x') + number(element, 'width') / 2,
    y: number(element, 'y') + number(element, 'height') / 2,
  };
}

afterEach(() => {
  cleanup();
  usePlaceStore.getState().reset();
  useSessionStore.getState().reset('');
});

test('placement_ghost_draws_pads_and_outline', () => {
  const { container, ghost } = mount();
  const body = container.querySelector('[data-layer="components.bodies"] polygon');
  expect(body?.getAttribute('points')).toBe('80.5,55.6 119.5,55.6 119.5,104.4 80.5,104.4');
  expect(body?.getAttribute('stroke-dasharray')).toBe('4 3');
  expect(ghost()?.querySelectorAll('[data-pad]') ?? []).toHaveLength(8);
  expect(rectCenter(pad(ghost()))).toEqual({ x: 72.25, y: 60.95 });
  expect(number(pad(ghost()), 'width')).toBe(15.5);
  expect(number(pad(ghost()), 'height')).toBe(6);
  expect(rectCenter(pad(ghost(), '8'))).toEqual({ x: 127.75, y: 60.95 });
  for (const shape of [body, ...ghost()!.querySelectorAll('[data-pad] > *')]) {
    expect(shape?.getAttribute('fill')).toBe('none');
    expect(shape?.getAttribute('stroke')).toBe('var(--sel)');
    expect(shape?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  }
});

// SOIC pin 1 is (-2.775, -1.905) mm, its body dot is (-1.35, -1.84) mm.
// These literals are hand-rotated into world coordinates about (100, 80).
const orientations = [
  ['none', 0, 72.25, 60.95, 86.5, 61.6],
  ['rot90', 270, 80.95, 107.75, 81.6, 93.5],
  ['rot180', 180, 127.75, 99.05, 113.5, 98.4],
  ['rot270', 90, 119.05, 52.25, 118.4, 66.5],
  ['mirror', 0, 72.25, 60.95, 86.5, 61.6],
  ['mirror_rot90', 90, 119.05, 52.25, 118.4, 66.5],
  ['mirror_rot180', 180, 127.75, 99.05, 113.5, 98.4],
  ['mirror_rot270', 270, 80.95, 107.75, 81.6, 93.5],
] as const;

test.each(orientations)(
  'placement_ghost_follows_scene_rotation %s',
  (transform, rotation, x, y, pin1X, pin1Y) => {
    const { engine, svg, start, pointer, click } = mountPlaceTool(transform);
    start({ mode: 'new', entryId: 'soic', params: soic.params });
    pointer('pointermove');
    expect(useSessionStore.getState().preview?.data).toEqual(soic);
    const ghost = svg.querySelector('[data-placement-ghost]');
    const first = pad(ghost);
    expect(rectCenter(first).x).toBeCloseTo(x);
    expect(rectCenter(first).y).toBeCloseTo(y);
    const actualRotation = first
      .getAttribute('transform')
      ?.match(/^rotate\(([^ ]+) ([^ ]+) ([^)]+)\)$/);
    expect(actualRotation).toBeTruthy();
    expect(Number(actualRotation![1])).toBe(rotation);
    expect(Number(actualRotation![2])).toBeCloseTo(x);
    expect(Number(actualRotation![3])).toBeCloseTo(y);
    const dot = ghost?.querySelector('[data-pin1]');
    expect(number(dot ?? null, 'cx')).toBeCloseTo(pin1X);
    expect(number(dot ?? null, 'cy')).toBeCloseTo(pin1Y);
    const bodyPoints = ghost?.querySelector('polygon')?.getAttribute('points');
    click();
    const component = engine.snapshot().doc.components[0]!;
    expect(component.board).toMatchObject({
      side: 'top',
      rotationDeg: rotation,
      scaleX: 1,
      scaleY: 1,
    });
    const placed = svg.querySelector(
      `[data-layer="components.pins"] [data-component="${component.id}"] [data-pin="1"] rect`,
    );
    expect(rectCenter(placed!).x).toBeCloseTo(x);
    expect(rectCenter(placed!).y).toBeCloseTo(y);
    expect(placed?.getAttribute('transform')).toBe(first.getAttribute('transform'));
    expect(
      svg
        .querySelector(
          `[data-layer="components.bodies"] [data-component="${component.id}"] polygon`,
        )
        ?.getAttribute('points'),
    ).toBe(bodyPoints);
  },
);

test('placement_ghost_pads_keep_five_screen_pixels_at_low_zoom', () => {
  const { ghost } = mount(soic, 0.25);
  const pads = ghost()?.querySelectorAll('[data-pad] > *') ?? [];
  expect(pads).toHaveLength(8);
  for (const shape of pads) {
    expect(number(shape, 'width')).toBe(20);
    expect(number(shape, 'height')).toBe(20);
  }
  expect(number(ghost()?.querySelector('[data-pin1]') ?? null, 'r')).toBe(8);
});

test('placement_ghost_uses_circle_and_oval_pad_shapes', () => {
  const { ghost, preview } = mount({ ...soic, footprint: 'dip', params: {} });
  expect(pad(ghost()).tagName).toBe('rect');
  const circle = pad(ghost(), '2');
  expect(circle.tagName).toBe('circle');
  expect(number(circle, 'r')).toBe(8);
  expect(number(circle, 'cx')).toBeCloseTo(61.9);
  expect(number(circle, 'cy')).toBeCloseTo(67.3);
  preview({ ...soic, footprint: 'dc_jack', params: {} });
  const oval = pad(ghost());
  expect(oval.tagName).toBe('rect');
  expect(number(oval, 'width')).toBe(32);
  expect(number(oval, 'height')).toBe(16);
  expect(number(oval, 'rx')).toBe(8);
  expect(rectCenter(oval)).toEqual({ x: 100, y: 28 });
});

test('placement_ghost_point_renders_one_pad_without_a_body_or_pin1_dot', () => {
  const { ghost } = mount({ ...soic, footprint: 'point', params: {} });
  expect(ghost()).toBeTruthy();
  expect(ghost()?.querySelectorAll('[data-pad]')).toHaveLength(1);
  const circle = pad(ghost());
  expect(circle.tagName).toBe('circle');
  expect(number(circle, 'cx')).toBe(100);
  expect(number(circle, 'cy')).toBe(80);
  expect(number(circle, 'r')).toBe(7.5);
  expect(ghost()?.querySelector('polygon')).toBeNull();
  expect(ghost()?.querySelector('[data-pin1]')).toBeNull();
});

test('placement_ghost_preview_never_changes_document_or_adds_hits', () => {
  const { container, engine, preview, ghost } = mount();
  const before = engine.snapshot();
  expect(ghost()).toBeTruthy();
  expect(ghost()?.getAttribute('pointer-events')).toBe('none');
  expect(ghost()?.closest('[data-layer]')?.getAttribute('data-layer')).toBe('components.bodies');
  expect(container.querySelector('[data-layer="components.pins"]')?.children).toHaveLength(0);
  expect(container.querySelector('[data-layer="components.labels"]')?.children).toHaveLength(0);
  preview({ ...soic, center: { x: 130, y: 120 } });
  expect(rectCenter(pad(ghost())).x).toBeCloseTo(102.25);
  expect(rectCenter(pad(ghost())).y).toBeCloseTo(100.95);
  expect(engine.snapshot()).toBe(before);
  for (const layer of COMPONENTS_LAYERS) {
    expect(layer.hits?.(engine.snapshot(), 1, 'none')).toEqual([]);
  }
  preview(null);
  expect(ghost()).toBeNull();
  expect(engine.snapshot()).toBe(before);
});
