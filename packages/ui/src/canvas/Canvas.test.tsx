// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Vec2 } from '@pcbk/domain';
import { snapshot } from '../../../client/src/__tests__/fakes';
import { useSessionStore } from '../shell/session-store';
import { Canvas } from './Canvas';
import type { CanvasProps } from './Canvas';
import { SceneText } from './scene-text';
import type { LayerSpec } from './tools';

const component = { kind: 'component', id: 'cmp_test' };
const pin = { kind: 'pin', id: '1', componentId: component.id };
const selection = () => useSessionStore.getState().selection;
const preview = () => useSessionStore.getState().preview;
const selectComponent = () =>
  act(() => useSessionStore.getState().setSelection({ items: [component] }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useSessionStore.getState().reset('');
});

function screenMatrix(zoom: number, pan: Vec2) {
  return {
    inverse: () => ({
      a: 1 / zoom,
      b: 0,
      c: 0,
      d: 1 / zoom,
      e: -pan.x / zoom,
      f: -pan.y / zoom,
    }),
  };
}

function setup(initial?: CanvasProps['view']) {
  const view = initial ?? { zoom: 1, pan: { x: 0, y: 0 } };
  const hitLayer = {
    id: 'test',
    z: 0,
    render: vi.fn<LayerSpec['render']>(() => <rect x={10} y={10} width={30} height={30} />),
    hits: vi.fn<NonNullable<LayerSpec['hits']>>(() => [
      {
        ...component,
        shape: {
          type: 'area',
          polygon: [
            { x: 10, y: 10 },
            { x: 40, y: 10 },
            { x: 40, y: 40 },
            { x: 10, y: 40 },
          ],
        },
      },
      { ...pin, priority: 1, shape: { type: 'point', at: { x: 25, y: 25 }, r: 1 } },
    ]),
  };
  const onViewChange = vi.fn<(next: CanvasProps['view']) => void>();
  const execute = vi.fn(() => ({ ok: true as const, value: { rev: 1 } }));
  let props: CanvasProps = {
    layers: [hitLayer],
    tools: [],
    sceneTransform: 'none',
    view,
    onViewChange,
    snapshot: snapshot(),
    execute,
  };
  useSessionStore.getState().reset(props.snapshot.sessionId);
  const result = render(<Canvas {...props} />);
  const svg = result.container.querySelector('svg')!;
  const scene = svg.querySelector('[data-scene]')!;
  const viewGroup = svg.querySelector('[data-view]')!;
  let captured: number | undefined;
  Object.defineProperties(svg, {
    getScreenCTM: { value: () => screenMatrix(1, { x: 0, y: 0 }) },
    setPointerCapture: {
      value: vi.fn((id: number) => {
        captured = id;
      }),
    },
    hasPointerCapture: { value: (id: number) => captured === id },
    releasePointerCapture: {
      value: vi.fn(() => {
        captured = undefined;
      }),
    },
  });
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => {
      const current = onViewChange.mock.lastCall?.[0] ?? props.view;
      return screenMatrix(current.zoom, current.pan);
    },
  });
  return {
    svg,
    viewGroup,
    execute,
    hitLayer,
    onViewChange,
    update(next: Partial<CanvasProps>) {
      props = { ...props, ...next };
      result.rerender(<Canvas {...props} />);
    },
  };
}

function pointer(target: Element, type: string, x: number, y: number, button = 0) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(target, event);
}

function click(target: Element, x: number, y: number) {
  pointer(target, 'pointerdown', x, y);
  pointer(target, 'pointerup', x, y);
}

test('click_selects_component_then_pin', () => {
  const { svg, execute } = setup();
  click(svg, 12, 12);
  expect(selection()).toEqual({ items: [component] });
  click(svg, 27, 25);
  expect(selection()).toEqual({ items: [pin] });
  click(svg, 3, 3);
  expect(selection()).toEqual({ items: [] });
  expect(execute).not.toHaveBeenCalled();
});

test('hit_index_rebuilds_on_rev_change', () => {
  const { hitLayer, update, svg } = setup();
  expect(hitLayer.hits).toHaveBeenCalledTimes(1);
  update({ view: { zoom: 2, pan: { x: 0, y: 0 } }, snapshot: snapshot() });
  click(svg, 25, 25);
  expect(hitLayer.hits).toHaveBeenCalledTimes(1);
  update({ snapshot: snapshot('session-a', 1) });
  expect(hitLayer.hits).toHaveBeenCalledTimes(2);
  update({ snapshot: snapshot('session-b', 1) });
  expect(hitLayer.hits).toHaveBeenCalledTimes(3);
});

test('drag_below_3px_is_a_click', () => {
  const { svg, execute } = setup();
  pointer(svg, 'pointerdown', 12, 12);
  pointer(svg, 'pointermove', 14, 12);
  expect(preview()).toBeNull();
  pointer(svg, 'pointerup', 14, 12);
  expect(selection()).toEqual({ items: [component] });
  expect(execute).not.toHaveBeenCalled();
});

test('drag_grab_offset_stays_under_cursor', () => {
  const { svg, execute } = setup({ zoom: 2, pan: { x: 40, y: -10 } });
  selectComponent();
  pointer(svg, 'pointerdown', 68, 18);
  pointer(svg, 'pointermove', 74, 26);
  expect(preview()).toEqual({ owner: 'select', data: { items: [component], dx: 3, dy: 4 } });
  expect(execute).not.toHaveBeenCalled();
});

test('drag_commits_one_translate_on_pointerup', () => {
  const { svg, execute } = setup();
  selectComponent();
  pointer(svg, 'pointerdown', 12, 12);
  pointer(svg, 'pointermove', 18, 20);
  pointer(svg, 'pointermove', 19, 22);
  expect(svg.setPointerCapture).toHaveBeenCalledOnce();
  expect(execute).not.toHaveBeenCalled();
  pointer(svg, 'pointerup', 21, 22);
  expect(execute).toHaveBeenCalledExactlyOnceWith('items.translate', {
    items: [component],
    dx: 9,
    dy: 10,
  });
  expect(preview()).toBeNull();
  expect(svg.releasePointerCapture).toHaveBeenCalledOnce();
});

test('drag_unselected_component_selects_and_moves_in_one_gesture', () => {
  const { svg, execute } = setup();
  act(() =>
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_other' }] }),
  );

  pointer(svg, 'pointerdown', 12, 12);
  expect(selection()).toEqual({ items: [component] });
  expect(preview()).toBeNull();
  pointer(svg, 'pointermove', 16, 17);
  expect(preview()).toEqual({ owner: 'select', data: { items: [component], dx: 4, dy: 5 } });
  expect(execute).not.toHaveBeenCalled();
  pointer(svg, 'pointerup', 19, 18);
  expect(execute).toHaveBeenCalledExactlyOnceWith('items.translate', {
    items: [component],
    dx: 7,
    dy: 6,
  });
  expect(preview()).toBeNull();
});

test('drag_from_pin_moves_its_component', () => {
  const { svg, execute } = setup();
  const other = { kind: 'component', id: 'cmp_other' };
  act(() => useSessionStore.getState().setSelection({ items: [component, other] }));
  const before = selection();

  pointer(svg, 'pointerdown', 25, 25);
  pointer(svg, 'pointermove', 27, 25);
  expect(selection()).toBe(before);
  expect(preview()).toBeNull();
  pointer(svg, 'pointermove', 28, 25);
  expect(selection()).toBe(before);
  expect(preview()).toEqual({ owner: 'select', data: { items: [component], dx: 3, dy: 0 } });
  expect(execute).not.toHaveBeenCalled();
  pointer(svg, 'pointerup', 31, 27);
  expect(execute).toHaveBeenCalledExactlyOnceWith('items.translate', {
    items: [component],
    dx: 6,
    dy: 2,
  });
  expect(preview()).toBeNull();
  expect(selection()).toBe(before);
});

test('drag_on_selected_component_keeps_group_selection', () => {
  const { svg, execute } = setup();
  const items = [component, { kind: 'component', id: 'cmp_other' }];
  act(() => useSessionStore.getState().setSelection({ items }));
  const before = selection();

  click(svg, 12, 12);
  expect(selection()).toBe(before);
  pointer(svg, 'pointerdown', 12, 12);
  expect(selection()).toBe(before);
  pointer(svg, 'pointermove', 18, 12);
  expect(preview()).toEqual({ owner: 'select', data: { items, dx: 6, dy: 0 } });
  pointer(svg, 'pointerup', 20, 13);
  expect(execute).toHaveBeenCalledExactlyOnceWith('items.translate', { items, dx: 8, dy: 1 });
  expect(selection()).toBe(before);
});

test.each(['escape', 'pointercancel', 'tool switch', 'project switch'] as const)(
  'cancelled_drag_leaves_no_trace (%s)',
  (reason) => {
    const { svg, execute, update } = setup();
    selectComponent();
    pointer(svg, 'pointerdown', 12, 12);
    pointer(svg, 'pointermove', 18, 20);
    expect(preview()).not.toBeNull();
    if (reason === 'escape') fireEvent.keyDown(svg, { key: 'Escape' });
    else if (reason === 'pointercancel') pointer(svg, 'pointercancel', 18, 20);
    else if (reason === 'tool switch') fireEvent.keyDown(svg, { key: 'h' });
    else update({ snapshot: snapshot('next-project') });

    expect(preview()).toBeNull();
    pointer(svg, 'pointerup', 24, 24);
    expect(execute).not.toHaveBeenCalled();
    expect(svg.releasePointerCapture).toHaveBeenCalledOnce();
  },
);

test('rev_change_during_drag_cancels_gesture', () => {
  const { svg, execute, update } = setup();
  pointer(svg, 'pointerdown', 12, 12);
  pointer(svg, 'pointermove', 18, 20);
  expect(preview()).not.toBeNull();

  update({ snapshot: snapshot() });
  expect(preview()).not.toBeNull();
  update({ snapshot: snapshot('session-a', 1) });

  expect(preview()).toBeNull();
  expect(svg.releasePointerCapture).toHaveBeenCalledOnce();
  pointer(svg, 'pointerup', 24, 24);
  expect(execute).not.toHaveBeenCalled();
});

test('wheel_zoom_keeps_cursor_point_fixed', () => {
  const before = { zoom: 2, pan: { x: 20, y: 10 } };
  const { svg, viewGroup, onViewChange } = setup(before);
  const point = { x: 80, y: 100 };
  const oldTransform = viewGroup.getAttribute('transform');
  fireEvent.wheel(svg, { clientX: point.x, clientY: point.y, deltaY: -100 });

  const after = onViewChange.mock.lastCall![0];
  expect(after.zoom).toBeGreaterThan(before.zoom);
  expect((point.x - after.pan.x) / after.zoom).toBeCloseTo(30);
  expect((point.y - after.pan.y) / after.zoom).toBeCloseTo(45);
  expect(viewGroup.getAttribute('transform')).not.toBe(oldTransform);
});

test('lod_updates_after_zoom_settles_not_during_pan', () => {
  vi.useFakeTimers();
  const { svg, hitLayer, onViewChange, update } = setup();
  expect(hitLayer.hits.mock.lastCall?.[1]).toBe(1);

  fireEvent.wheel(svg, { deltaY: -100 });
  act(() => vi.advanceTimersByTime(100));
  fireEvent.wheel(svg, { deltaY: -100 });
  const zoomed = onViewChange.mock.lastCall![0];
  update({ view: zoomed });
  act(() => vi.advanceTimersByTime(100));
  update({ view: { ...zoomed, pan: { x: 4, y: 5 } } });
  act(() => vi.advanceTimersByTime(119));
  expect(hitLayer.render).toHaveBeenCalledTimes(1);
  expect(hitLayer.hits).toHaveBeenCalledTimes(1);

  act(() => vi.advanceTimersByTime(1));
  expect(hitLayer.render).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersToNextFrame());
  expect(hitLayer.render).toHaveBeenCalledTimes(2);
  expect(hitLayer.render.mock.lastCall?.[0].zoom).toBe(zoomed.zoom);
  expect(hitLayer.hits).toHaveBeenCalledTimes(2);
  expect(hitLayer.hits.mock.lastCall?.[1]).toBe(zoomed.zoom);

  pointer(svg, 'pointerdown', 12, 12, 1);
  pointer(svg, 'pointermove', 18, 20, 1);
  pointer(svg, 'pointerup', 21, 22, 1);
  update({ view: onViewChange.mock.lastCall![0] });
  act(() => vi.runAllTimers());
  expect(hitLayer.render).toHaveBeenCalledTimes(2);
  expect(hitLayer.hits).toHaveBeenCalledTimes(2);
});

test('hit_tolerance_uses_live_zoom_before_lod_settles', () => {
  const { svg } = setup();
  fireEvent.wheel(svg, { deltaY: -Math.log(2) / 0.002 });

  click(svg, 58, 50);

  expect(selection()).toEqual({ items: [component] });
});

test('scene_text_inherits_canvas_transform', () => {
  const { svg, update } = setup();
  update({
    sceneTransform: 'mirror',
    layers: [
      {
        id: 'label',
        z: 1,
        render: () => (
          <SceneText x={10} y={20}>
            R1
          </SceneText>
        ),
      },
    ],
  });
  expect(svg.querySelector('text')?.getAttribute('transform')).toBe('matrix(-1 0 0 1 20 0)');
});

test.each(['middle', 'space', 'tool'] as const)('pan_does_not_rerender_layers (%s)', (method) => {
  const { svg, hitLayer, onViewChange, update } = setup();
  if (method === 'space') fireEvent.keyDown(svg, { key: ' ', code: 'Space' });
  if (method === 'tool') fireEvent.keyDown(svg, { key: 'h' });
  const button = method === 'middle' ? 1 : 0;
  pointer(svg, 'pointerdown', 12, 12, button);
  pointer(svg, 'pointermove', 18, 20, button);
  pointer(svg, 'pointerup', 21, 22, button);
  const view = onViewChange.mock.lastCall![0];
  expect(view).toEqual({ zoom: 1, pan: { x: 9, y: 10 } });
  update({ view });
  expect(hitLayer.render).toHaveBeenCalledTimes(1);
  expect(hitLayer.hits).toHaveBeenCalledTimes(1);
  expect(selection()).toEqual({ items: [] });
});

test('escape_returns_to_select_and_clears_selection', () => {
  const { svg } = setup();
  selectComponent();
  fireEvent.keyDown(svg, { key: 'h' });
  expect(useSessionStore.getState().toolId).toBe('pan');
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(selection()).toEqual({ items: [] });
});

test('arrow_keys_nudge_with_one_command_each', () => {
  const { svg, execute } = setup();
  selectComponent();
  fireEvent.keyDown(svg, { key: 'ArrowLeft' });
  fireEvent.keyDown(svg, { key: 'ArrowDown', shiftKey: true });
  expect(execute.mock.calls).toEqual([
    ['items.translate', { items: [component], dx: -1, dy: 0 }],
    ['items.translate', { items: [component], dx: 0, dy: 10 }],
  ]);
  render(<input aria-label="Test" />);
  const input = screen.getByRole('textbox', { name: 'Test' });
  fireEvent.keyDown(input, { key: 'ArrowRight' });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(execute).toHaveBeenCalledTimes(2);
  expect(selection()).toEqual({ items: [component] });
});
