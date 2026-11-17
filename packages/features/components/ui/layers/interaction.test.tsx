// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useMemo, useSyncExternalStore } from 'react';
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
  const registry = new UiRegistry([createComponentsUi(idGenerator())]);
  const layers = registry.canvasLayers();
  const execute = vi.fn<ToolApi['execute']>((...args) => engine.execute(...args));
  const view = { zoom, pan: { x: 0, y: 0 } };
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  function Board() {
    const snapshot = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
    const selection = useSessionStore((state) => state.selection);
    const currentLayers = useMemo(() => registry.canvasLayers(), [selection]);
    return (
      <Canvas
        layers={currentLayers}
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

const area = { footprint: 'area', params: {} };

function selectComponent() {
  act(() => useSessionStore.getState().setSelection({ items: [component] }));
}

function scaleHandle(svg: SVGSVGElement, handle: string) {
  const node = svg.querySelector<SVGRectElement>(`[data-scale-handle="${handle}"]`);
  if (!node) throw new Error(`Expected visible scale handle ${handle}`);
  return {
    x: Number(node.getAttribute('x')) + Number(node.getAttribute('width')) / 2,
    y: Number(node.getAttribute('y')) + Number(node.getAttribute('height')) / 2,
  };
}

function dragHandle(svg: SVGSVGElement, handle: string, dx: number, dy: number) {
  const at = scaleHandle(svg, handle);
  pointer(svg, 'pointerdown', at.x, at.y);
  pointer(svg, 'pointermove', at.x + dx, at.y + dy);
  pointer(svg, 'pointerup', at.x + dx, at.y + dy);
}

test('corner_handle_scales_uniformly', () => {
  for (const { rotationDeg, side, dx, dy } of [
    { rotationDeg: 0, side: 'top', dx: 20, dy: 20 },
    { rotationDeg: 90, side: 'top', dx: -20, dy: 20 },
    { rotationDeg: 90, side: 'bottom', dx: -20, dy: -20 },
  ] as const) {
    const { svg, engine } = mount({ ...area, scaleY: 0.8, rotationDeg, side });
    selectComponent();
    dragHandle(svg, 'se', dx, dy);
    const board = engine.snapshot().doc.components[0]!.board!;
    expect(board.scaleX).toBeCloseTo(1.5);
    expect(board.scaleY).toBeCloseTo(1.2);
    cleanup();
  }
});

test('side_handle_scales_one_axis', () => {
  const { svg, engine } = mount({ ...area, rotationDeg: 90, side: 'bottom' });
  selectComponent();
  dragHandle(svg, 'e', 15, -20);
  expect(engine.snapshot().doc.components[0]!.board).toMatchObject({ scaleX: 1.5, scaleY: 1 });
});

test('scale_is_one_undo_step', () => {
  const { svg, engine, execute } = mount(area);
  const before = engine.snapshot().doc.components[0]!.board!;
  selectComponent();
  const at = scaleHandle(svg, 'e');
  pointer(svg, 'pointerdown', at.x, at.y);
  pointer(svg, 'pointermove', at.x + 20, at.y);
  expect(useSessionStore.getState().preview).toMatchObject({ owner: 'components.scale' });
  expect(engine.snapshot().doc.components[0]!.board).toBe(before);
  expect(execute).not.toHaveBeenCalled();
  expect(scaleHandle(svg, 'e').x).toBeCloseTo(at.x + 20);
  pointer(svg, 'pointerup', at.x + 20, at.y);
  expect(execute).toHaveBeenCalledExactlyOnceWith('components.setScale', {
    id,
    scaleX: 1.5,
    scaleY: 1,
  });
  expect(engine.snapshot().doc.components[0]!.board?.center).toEqual(before.center);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board).toEqual(before);
});

test('scale_clamped_to_schema_limits', () => {
  const { svg, engine } = mount({ ...area, scaleY: 0.5 });
  selectComponent();
  dragHandle(svg, 'se', 1000, 1000);
  expect(engine.snapshot().doc.components[0]!.board).toMatchObject({ scaleX: 5, scaleY: 2.5 });
  dragHandle(svg, 'se', -1000, -1000);
  expect(engine.snapshot().doc.components[0]!.board).toMatchObject({ scaleX: 0.4, scaleY: 0.2 });
});

test('scale_handles_are_available_only_for_one_selected_component', () => {
  const { svg, engine, layers } = mount(area, 2);
  const handles = () => svg.querySelectorAll('[data-scale-handle]');
  expect(handles()).toHaveLength(0);
  selectComponent();
  expect(handles()).toHaveLength(8);
  expect(Number(handles()[0]?.getAttribute('width')) * 2).toBe(8);
  const layer = layers.find(({ id }) => id === 'components.handles');
  expect(layer?.hits?.(engine.snapshot(), 2, 'none')).toHaveLength(8);
  act(() =>
    useSessionStore
      .getState()
      .setSelection({ items: [component, { kind: 'component', id: 'other' }] }),
  );
  expect(handles()).toHaveLength(0);
  expect(layer?.hits?.(engine.snapshot(), 2, 'none')).toEqual([]);
});

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
  { placement: {}, at: { x: 100, y: 41.05 }, expectedOffset: { x: 8, y: -41.95 } },
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
      [-24.04, -11],
      [24.04, -11],
      [24.04, 30.2],
      [-24.04, 30.2],
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
