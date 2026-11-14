// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useSyncExternalStore } from 'react';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement } from '@pcbk/domain';
import { Canvas, UiRegistry, useSessionStore } from '@pcbk/ui';
import type { SceneTransform, ToolApi } from '@pcbk/ui';
import { idGenerator, setup } from '../../../__tests__/helpers';
import { createComponentsUi } from '..';

const id = 'cmp_r1';
const component = { kind: 'component', id };
const center = { x: 100, y: 80 };
const labelOffset = { x: 60, y: -40 };
const labelAt = { x: 160, y: 40 };

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
});

function mount(
  placement: Partial<BoardPlacement> = {},
  zoom = 1,
  sceneTransform: SceneTransform = 'none',
) {
  const doc = newBoardDoc('Plaadi proov');
  doc.scale.pxPerMm = 10;
  doc.components.push({
    id,
    ref: 'R1',
    kind: 'resistor',
    marking: '',
    value: '100R',
    identified: true,
    dnp: false,
    note: '',
    pins: [
      { id: '1', uid: 'pin_r1_1', nc: false },
      { id: '2', uid: 'pin_r1_2', nc: false },
    ],
    board: {
      center,
      footprint: 'chip',
      params: { size: '0805' },
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
      ...placement,
    },
  });
  const { engine } = setup(doc);
  const layers = new UiRegistry([createComponentsUi(idGenerator())]).canvasLayers();
  const execute = vi.fn<ToolApi['execute']>((...args) => engine.execute(...args));
  const view = { zoom, pan: { x: 0, y: 0 } };
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  function Board() {
    const snapshot = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
    return (
      <Canvas
        layers={layers}
        tools={[]}
        sceneTransform={sceneTransform}
        view={view}
        onViewChange={() => {}}
        snapshot={snapshot}
        execute={execute}
      />
    );
  }
  const rendered = render(<Board />);
  const svg = rendered.container.querySelector('svg')!;
  const scene = svg.querySelector('[data-scene]')!;
  Object.defineProperties(svg, {
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: vi.fn() },
  });
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => ({ inverse: () => ({ a: 1 / zoom, b: 0, c: 0, d: 1 / zoom, e: 0, f: 0 }) }),
  });
  return { ...rendered, svg, engine, execute, layers };
}

function pointer(svg: SVGSVGElement, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(svg, event);
}

function click(svg: SVGSVGElement, x: number, y: number) {
  pointer(svg, 'pointerdown', x, y);
  pointer(svg, 'pointerup', x, y);
}

test('rotated_component_pin_hit_selects_that_pin', () => {
  const { svg } = mount({ rotationDeg: 90 });
  // 0805 pin 1 is 1 mm left of the center before the 90-degree rotation.
  click(svg, 100, 70);
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'pin', id: '1', componentId: id },
  ]);
});

test.each([
  { placement: { labelOffset }, at: labelAt, expectedOffset: { x: 68, y: -43 } },
  { placement: {}, at: { x: 100, y: 63.75 }, expectedOffset: { x: 8, y: -19.25 } },
])('label_drag_outside_body_changes_only_label_offset %#', ({ placement, at, expectedOffset }) => {
  const { svg, engine, execute } = mount(placement);
  const before = engine.snapshot().doc.components[0]!;
  pointer(svg, 'pointerdown', at.x, at.y);
  pointer(svg, 'pointermove', at.x + 7, at.y - 4);
  expect(useSessionStore.getState().preview).toEqual({
    owner: 'components.label',
    data: { id, dx: 7, dy: -4 },
  });
  expect(engine.snapshot().doc.components[0]).toBe(before);
  expect(execute).not.toHaveBeenCalled();

  pointer(svg, 'pointerup', at.x + 8, at.y - 3);
  expect(execute).toHaveBeenCalledExactlyOnceWith('components.setLabelOffset', {
    id,
    offset: expectedOffset,
  });
  expect(engine.snapshot().doc.components[0]).toEqual({
    ...before,
    board: { ...before.board, labelOffset: expectedOffset },
  });
  expect(useSessionStore.getState().preview).toBeNull();
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]).toEqual(before);
});

test('hidden_label_has_no_hit_area', () => {
  const { engine, layers } = mount({ labelOffset }, 0.4);
  const labelLayer = layers.find((layer) => layer.id === 'components.labels');
  expect(labelLayer).toBeDefined();
  expect(labelLayer!.hits?.(engine.snapshot(), 0.4, 'none')).toEqual([]);
  expect(labelLayer!.hits?.(engine.snapshot(), 0.5, 'none')).toHaveLength(1);
});

test('label_click_selects_component', () => {
  const { svg, execute } = mount({ labelOffset });
  pointer(svg, 'pointerdown', labelAt.x, labelAt.y);
  expect(useSessionStore.getState().selection.items).toEqual([]);
  pointer(svg, 'pointerup', labelAt.x, labelAt.y);
  expect(useSessionStore.getState().selection.items).toEqual([component]);
  expect(execute).not.toHaveBeenCalled();
});

test('label_hit_area_matches_screen_text_under_all_8_transforms', () => {
  const transforms = {
    none: [1, 0, 0, 1],
    rot90: [0, 1, -1, 0],
    rot180: [-1, 0, 0, -1],
    rot270: [0, -1, 1, 0],
    mirror: [-1, 0, 0, 1],
    mirror_rot90: [0, -1, -1, 0],
    mirror_rot180: [1, 0, 0, -1],
    mirror_rot270: [0, 1, 1, 0],
  } as const;
  for (const transform of Object.keys(transforms) as SceneTransform[]) {
    const { svg, engine, layers } = mount({ labelOffset }, 2, transform);
    const [a, b, c, d] = transforms[transform];
    const projectOffset = (x: number, y: number) => ({
      x: a * (x - labelAt.x) + c * (y - labelAt.y),
      y: b * (x - labelAt.x) + d * (y - labelAt.y),
    });
    const label = layers.find(({ id }) => id === 'components.labels')!;
    const hit = label.hits!(engine.snapshot(), 2, transform)[0]!;
    expect(hit.shape.type).toBe('area');
    if (hit.shape.type !== 'area') throw new Error('Expected label polygon');
    const expected = [
      [-23.4, -9],
      [23.4, -9],
      [23.4, 28.2],
      [-23.4, 28.2],
    ];
    hit.shape.polygon.forEach(({ x, y }, index) => {
      const screen = projectOffset(x, y);
      expect(screen.x, transform).toBeCloseTo(expected[index]![0]!);
      expect(screen.y, transform).toBeCloseTo(expected[index]![1]!);
    });
    const texts = svg.querySelectorAll('[data-layer="components.labels"] text');
    const value = [...texts].find((text) => text.textContent === '100R')!;
    const valueOffset = projectOffset(
      Number(value.getAttribute('x')),
      Number(value.getAttribute('y')),
    );
    expect(valueOffset.x, transform).toBeCloseTo(0);
    expect(valueOffset.y, transform).toBeCloseTo(19.2);
    act(() =>
      useSessionStore.getState().setPreview({
        owner: 'components.label',
        data: { id, dx: 7, dy: -4 },
      }),
    );
    expect(value.closest('[transform="translate(7 -4)"]')).toBeTruthy();
    cleanup();
    useSessionStore.getState().reset('');
  }
});
