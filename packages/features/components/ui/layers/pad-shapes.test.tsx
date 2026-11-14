// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement, Component } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { createHitIndex } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
import { ComponentShape } from './ComponentShape';
import type { ComponentLayerKind } from './ComponentShape';
import { componentPinHits } from './hits';

const center = { x: 100, y: 80 };

function component(board: Partial<BoardPlacement> = {}): Component & { board: BoardPlacement } {
  return {
    id: 'cmp_a',
    ref: 'U1',
    kind: 'ic',
    identified: true,
    dnp: false,
    marking: '',
    value: '',
    note: '',
    pins: Array.from({ length: 8 }, (_, index) => ({
      id: String(index + 1),
      uid: `pin_${index + 1}`,
      nc: false,
    })),
    board: {
      footprint: 'soic',
      params: {},
      center,
      side: 'top',
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: {},
      ...board,
    },
  };
}

function mount(
  part = component(),
  kind: ComponentLayerKind = 'pins',
  zoom = 1,
  selectedPinId: string | null = null,
  pxPerMm = newBoardDoc('Plaat').scale.pxPerMm,
) {
  return render(
    <svg>
      <ComponentShape
        kind={kind}
        component={part}
        pxPerMm={pxPerMm}
        zoom={zoom}
        selected={false}
        selectedPinId={selectedPinId}
        dx={0}
        dy={0}
        labelDx={0}
        labelDy={0}
      />
    </svg>,
  ).container;
}

function number(element: Element | null, name: string) {
  expect(element).toBeTruthy();
  return Number(element!.getAttribute(name));
}

function rotatedAt(element: Element, angle: number, x: number, y: number) {
  const rotation = element.getAttribute('transform')?.match(/^rotate\(([^ ]+) ([^ ]+) ([^)]+)\)$/);
  expect(rotation).toBeTruthy();
  expect(Number(rotation![1])).toBe(angle);
  expect(Number(rotation![2])).toBeCloseTo(x);
  expect(Number(rotation![3])).toBeCloseTo(y);
}

function outline(container: Element, id = '1') {
  const element = container.querySelector(`[data-pin="${id}"] [stroke="var(--ink-3)"]`);
  expect(element).toBeTruthy();
  return element!;
}

afterEach(cleanup);

test('soic8_neighbour_pins_do_not_overlap_at_100_percent', () => {
  const container = mount();
  const first = outline(container);
  const second = outline(container, '2');
  expect(first.tagName).toBe('rect');
  expect(second.tagName).toBe('rect');
  expect(number(first, 'width')).toBeCloseTo(15.5);
  expect(number(first, 'height')).toBeCloseTo(6);
  expect(number(second, 'y') - (number(first, 'y') + number(first, 'height'))).toBeCloseTo(6.7);
});

test.each([
  ['top', 0, 72.25, 60.95],
  ['top', 90, 119.05, 52.25],
  ['top', 180, 127.75, 99.05],
  ['top', 270, 80.95, 107.75],
  ['bottom', 0, 127.75, 60.95],
  ['bottom', 90, 119.05, 107.75],
  ['bottom', 180, 72.25, 99.05],
  ['bottom', 270, 80.95, 52.25],
] as const)('pin_marker_follows_component_rotation_and_side %s %i', (side, rotationDeg, x, y) => {
  const part = component({ side, rotationDeg });
  const rect = outline(mount(part));
  expect(rect.tagName).toBe('rect');
  expect(number(rect, 'x') + number(rect, 'width') / 2).toBeCloseTo(x);
  expect(number(rect, 'y') + number(rect, 'height') / 2).toBeCloseTo(y);
  expect(number(rect, 'width')).toBeCloseTo(15.5);
  expect(number(rect, 'height')).toBeCloseTo(6);
  rotatedAt(rect, rotationDeg, x, y);
  const pad = boardPads(part.board, ['1'], 10)[0]!;
  expect(pad.at.x).toBeCloseTo(x);
  expect(pad.at.y).toBeCloseTo(y);
});

test('pin1_dot_drawn_at_footprint_pin1', () => {
  const container = mount(component({ side: 'bottom', rotationDeg: 90 }), 'bodies');
  const dot = container.querySelector('circle[fill="var(--body)"]');
  expect(dot).toBeTruthy();
  expect(number(dot!, 'cx')).toBeCloseTo(118.4);
  expect(number(dot!, 'cy')).toBeCloseTo(93.5);
  expect(number(dot!, 'r')).toBe(2.5);
  expect(dot?.getAttribute('stroke')).toBe('var(--halo)');
  expect(dot?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
});

test('pin1_dot_keeps_minimum_screen_radius_and_is_absent_without_footprint_marker', () => {
  const container = mount(component(), 'bodies', 0.25);
  expect(number(container.querySelector('circle[fill="var(--body)"]')!, 'r')).toBe(8);
  cleanup();
  expect(mount(component({ footprint: 'chip' }), 'bodies').querySelector('circle')).toBeNull();
});

test('selected_rect_outline_adds_two_screen_pixels_to_each_half_side', () => {
  const container = mount(component({ rotationDeg: 90 }), 'pins', 0.25, '2');
  const pad = outline(container, '2');
  const selected = container.querySelector('[data-pin="2"] [stroke="var(--sel)"]')!;
  expect(pad.tagName).toBe('rect');
  expect(number(pad, 'width')).toBe(20);
  expect(number(pad, 'height')).toBe(20);
  expect(selected.tagName).toBe('rect');
  expect(number(selected, 'width')).toBe(36);
  expect(number(selected, 'height')).toBe(36);
  expect(selected.getAttribute('transform')).toBe(pad.getAttribute('transform'));
  expect(container.querySelectorAll('[stroke="var(--sel)"]')).toHaveLength(1);
});

test('rect_labels_use_short_half_side_at_number_and_name_thresholds', () => {
  const part = component();
  part.pins[0]!.name = 'Ground';
  expect(mount(part, 'labels', 2.32).querySelector('text')).toBeTruthy(); // component ref
  expect(document.querySelector('text')?.textContent).toBe('U1');
  cleanup();
  const numbers = mount(part, 'labels', 7 / 3);
  const pinNumber = [...numbers.querySelectorAll('text')].find((text) => text.textContent === '1')!;
  expect(pinNumber).toBeTruthy();
  expect(number(pinNumber, 'font-size')).toBeCloseTo(24 / 7);
  expect(numbers.textContent).not.toContain('Ground');
  cleanup();
  expect(mount(part, 'labels', 4.66).textContent).not.toContain('Ground');
  cleanup();
  const names = mount(part, 'labels', 14 / 3);
  const name = [...names.querySelectorAll('text')].find((text) => text.textContent === 'Ground')!;
  expect(name).toBeTruthy();
  expect(number(name, 'font-size')).toBe(3);
});

test('nc_cross_rotates_with_rect_top_right_corner_and_survives_hidden_numbers', () => {
  const part = component({ rotationDeg: 90 });
  part.pins[0]!.nc = true;
  const container = mount(part, 'labels');
  expect(container.textContent).toBe('U1');
  const cross = container.querySelector('path[stroke="var(--ink-3)"]')!;
  rotatedAt(cross, 90, 119.05, 52.25);
  const vertices = cross
    .getAttribute('d')!
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number);
  [123.8, 46.25, 129.8, 52.25, 129.8, 46.25, 123.8, 52.25].forEach((value, index) => {
    expect(vertices[index]).toBeCloseTo(value);
  });
  expect(container.querySelectorAll('path')).toHaveLength(2);
});

test('component_pin_hits_keep_pad_shape_size_rotation_and_priority', () => {
  const doc = newBoardDoc('Plaat');
  doc.components.push(component({ side: 'bottom', rotationDeg: 90 }));
  const hits = componentPinHits(setup(doc).engine.snapshot());
  expect(hits[0]).toEqual({
    kind: 'pin',
    id: '1',
    componentId: 'cmp_a',
    priority: 2,
    shape: {
      type: 'rect',
      at: { x: expect.closeTo(119.05), y: 107.75 },
      half: { x: 7.75, y: 3 },
      angleDeg: 90,
    },
  });
  expect(hits).toHaveLength(8);
});

test('component_pin_hit_rejects_outside_short_side_but_accepts_pad_edge', () => {
  const doc = newBoardDoc('Plaat');
  const part = component();
  part.pins = part.pins.slice(0, 1);
  doc.components.push(part);
  const index = createHitIndex(componentPinHits(setup(doc).engine.snapshot()));
  expect(index.query({ x: 80, y: 60.95 }, 1)?.id).toBe('1');
  expect(index.query({ x: 72.25, y: 64.05 }, 1)).toBeUndefined();
});

test('custom_circle_hit_uses_horizontal_half_size_and_has_no_unplaced_hits', () => {
  const doc = newBoardDoc('Plaat');
  const part = component({
    footprint: 'area',
    scaleX: 2,
    scaleY: 3,
    customPads: { '1': { local: { x: 0, y: 0 }, sizeMm: 2, shape: 'circle', through: false } },
  });
  const unplaced = component();
  unplaced.pins = unplaced.pins.map((pin) => ({ ...pin, uid: `${pin.uid}_unplaced` }));
  doc.components.push(part, { ...unplaced, id: 'cmp_unplaced', ref: 'U2', board: undefined });
  expect(componentPinHits(setup(doc).engine.snapshot())).toEqual([
    {
      kind: 'pin',
      id: '1',
      componentId: 'cmp_a',
      priority: 2,
      shape: { type: 'point', at: center, r: 20 },
    },
  ]);
});

test('circle_render_and_selection_use_horizontal_half_size', () => {
  const part = component({
    footprint: 'area',
    scaleX: 2,
    scaleY: 3,
    customPads: { '1': { local: { x: 0, y: 0 }, sizeMm: 2, shape: 'circle', through: false } },
  });
  const container = mount(part, 'pins', 0.5, '1');
  const pad = outline(container);
  expect(pad.tagName).toBe('circle');
  expect(number(pad, 'cx')).toBe(100);
  expect(number(pad, 'cy')).toBe(80);
  expect(number(pad, 'r')).toBe(20);
  expect(number(container.querySelector('[stroke="var(--sel)"]'), 'r')).toBe(24);
});

test('pin_name_starts_outside_long_rect_at_visible_name_zoom', () => {
  for (const [rotationDeg, rightEdge] of [
    [0, 7.75],
    [45, 7.6013978977554],
    [90, 3],
    [180, 7.75],
    [270, 3],
  ] as const) {
    const part = component({ rotationDeg });
    part.pins[0]!.name = 'Ground';
    const container = mount(part, 'labels', 5);
    const name = [...container.querySelectorAll('text')].find(
      (text) => text.textContent === 'Ground',
    )!;
    // Hand-projected right extent of the 15.5 x 6 px pad, plus2 screenpixels.
    expect(number(name, 'dx')).toBeGreaterThanOrEqual(rightEdge + 2 / 5);
    cleanup();
  }
});

test('circle_nc_cross_uses_the_visible_radius_on_both_axes', () => {
  const part = component({
    footprint: 'area',
    scaleX: 1,
    scaleY: 5,
    customPads: { '1': { local: { x: 0, y: 0 }, sizeMm: 2, shape: 'circle', through: false } },
  });
  part.pins[0]!.nc = true;
  const container = mount(part, 'labels');
  const cross = container.querySelector('path[stroke="var(--ink-3)"]')!;
  // Circle center (100,80), radius10: top-right (110,70), cross arms +/-3.
  expect(cross.getAttribute('d')).toBe('M107,67 L113,73 M113,67 L107,73');
});
