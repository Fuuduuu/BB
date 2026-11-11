// @vitest-environment jsdom
import { componentEt } from './i18n/et';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import { Canvas, useSessionStore } from '@pcbk/ui';
import type { ToolApi } from '@pcbk/ui';
import { idGenerator, setup } from '../../__tests__/helpers';
import { COMPONENTS_LAYERS } from './layers';
import { createPlaceToolSpec } from './PlaceTool';
import { beginPlacement, usePlaceStore } from './place-store';
import type { PlacementRequest } from './place-store';

const resistor = { mode: 'new', entryId: 'r_smd', params: { size: '0805' } } as const;
const center = { x: 100, y: 80 };

afterEach(() => {
  cleanup();
  usePlaceStore.getState().reset();
  useSessionStore.getState().reset('');
});

function mount() {
  const doc = newBoardDoc('Paigutuse proov');
  doc.scale.pxPerMm = 10;
  const { engine } = setup(doc);
  const tools = [createPlaceToolSpec(idGenerator())];
  const execute = vi.fn<ToolApi['execute']>((...args) => engine.execute(...args));
  const view = { zoom: 2, pan: { x: 0, y: 0 } };
  useSessionStore.getState().reset(engine.snapshot().sessionId);

  function Board() {
    const snapshot = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
    return (
      <Canvas
        layers={COMPONENTS_LAYERS}
        tools={tools}
        snapshot={snapshot}
        execute={execute}
        sceneTransform="none"
        view={view}
        onViewChange={() => {}}
      />
    );
  }

  const { container } = render(<Board />);
  const svg = container.querySelector('svg')!;
  const scene = svg.querySelector('[data-scene]')!;
  Object.defineProperties(svg, {
    setPointerCapture: { value: () => {} },
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: () => {} },
  });
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => ({ inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 }) }),
  });

  function pointer(type: string, x = 200, y = 160, button = 0) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  }

  function click() {
    pointer('pointerdown');
    pointer('pointerup');
  }

  function start(request: PlacementRequest = resistor) {
    act(() => beginPlacement(request));
  }

  return { engine, execute, svg, pointer, click, start };
}

test('place_tool_adds_placed_component_in_one_command', () => {
  const { engine, execute, click, start } = mount();
  start();
  click();

  expect(execute).toHaveBeenCalledExactlyOnceWith('components.add', {
    id: 'cmp_1',
    kind: 'resistor',
    pins: [
      { id: '1', uid: 'pin_2' },
      { id: '2', uid: 'pin_3' },
    ],
    board: { footprint: 'chip', params: { size: '0805' }, center },
  });
  expect(engine.snapshot().doc.components[0]).toMatchObject({ ref: 'R1', board: { center } });
  act(() => engine.undo());
  expect(engine.snapshot().doc.components).toEqual([]);
});

test('place_tool_esc_leaves_no_trace', () => {
  const { engine, execute, pointer, start } = mount();
  const before = engine.snapshot();
  start();
  pointer('pointermove');
  pointer('pointerdown');

  fireEvent.keyDown(window, { key: 'Escape' });
  pointer('pointerup');

  expect(execute).not.toHaveBeenCalled();
  expect(engine.snapshot()).toBe(before);
  expect(useSessionStore.getState()).toMatchObject({ toolId: 'select', preview: null });
  expect(usePlaceStore.getState()).toMatchObject({ request: null, error: null });
  start();
  pointer('pointerdown');
  pointer('pointerup');
  expect(engine.snapshot().doc.components[0]?.id).toBe('cmp_1');
});

test('new_component_value_and_marking_are_empty', () => {
  const { engine, click, start } = mount();
  start({ mode: 'new', entryId: 'c_smd', params: { size: '0603' } });
  click();

  expect(engine.snapshot().doc.components[0]).toMatchObject({
    value: '',
    marking: '',
    board: { params: { size: '0603' } },
  });
});

test('unknown_component_is_area_with_manual_pins', () => {
  const { engine, click, start } = mount();
  start({ mode: 'new', entryId: 'unknown', params: { w: 4.5, h: 9 } });
  click();

  const component = engine.snapshot().doc.components[0]!;
  expect(component).toMatchObject({
    ref: 'X1',
    kind: 'other',
    identified: false,
    pins: [],
    board: { footprint: 'area', params: { w: 4.5, h: 9 } },
  });
  act(() =>
    engine.execute('components.addPin', { id: component.id, pin: { id: 'A', uid: 'pin_a' } }),
  );
  expect(engine.snapshot().doc.components[0]?.pins).toMatchObject([{ id: 'A', uid: 'pin_a' }]);
});

test('place_tool_preview_follows_cursor', () => {
  const { engine, execute, svg, pointer, start } = mount();
  const before = engine.snapshot();
  const outline = () => svg.querySelector('[data-layer="components.bodies"] [stroke="var(--sel)"]');
  start();
  expect(outline()).toBeNull();
  pointer('pointermove');
  expect(outline()?.getAttribute('points')).toBe('90,73.75 110,73.75 110,86.25 90,86.25');
  expect(outline()?.getAttribute('stroke-dasharray')).toBeTruthy();
  expect(outline()?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  pointer('pointermove', 220, 150);
  expect(outline()?.getAttribute('points')).toBe('100,68.75 120,68.75 120,81.25 100,81.25');
  expect(useSessionStore.getState().preview).toEqual({
    owner: 'components.place',
    data: { footprint: 'chip', params: { size: '0805' }, center: { x: 110, y: 75 } },
  });
  expect(execute).not.toHaveBeenCalled();
  expect(engine.snapshot()).toBe(before);
});

test('placed_component_becomes_selected_and_tool_returns_to_select', () => {
  const { click, pointer, start } = mount();
  start();
  pointer('pointermove');
  click();

  expect(useSessionStore.getState()).toMatchObject({
    selection: { items: [{ kind: 'component', id: 'cmp_1' }] },
    toolId: 'select',
    preview: null,
  });
  expect(usePlaceStore.getState()).toMatchObject({ request: null, error: null });
});

test.each<{ footprint: string; params: PlacementRequest['params']; pinIds: string[] }>([
  { footprint: 'chip', params: { size: '0805' }, pinIds: ['2', '1'] },
  { footprint: 'area', params: { w: 4, h: 8 }, pinIds: ['PWR', 'GND'] },
])('place_existing_keeps_pin_uids ($footprint)', ({ footprint, params, pinIds }) => {
  const { engine, execute, click, start } = mount();
  const id = 'cmp_existing';
  const pins = pinIds.map((pinId, index) => ({ id: pinId, uid: `pin_${index}` }));
  act(() => engine.execute('components.add', { id, kind: 'other', pins }));
  const board = { footprint, params, center };
  act(() => engine.execute('components.placeOnBoard', { id, board }));
  act(() => engine.execute('components.removeFromBoard', { id }));
  expect(engine.snapshot().doc.components[0]?.board).toBeUndefined();
  const before = engine.snapshot().doc.components[0]?.pins;

  start({ mode: 'existing', componentId: id, footprint, params });
  click();

  expect(execute).toHaveBeenCalledExactlyOnceWith('components.placeOnBoard', { id, board });
  expect(engine.snapshot().doc.components[0]).toMatchObject({ id, board, pins: before });
  expect(useSessionStore.getState().selection.items).toEqual([{ kind: 'component', id }]);
});

test('dragging at least three screen pixels does not place the component', () => {
  const { execute, pointer, start } = mount();
  start();
  pointer('pointerdown');
  pointer('pointermove', 203, 160);
  pointer('pointerup');
  pointer('pointerdown');
  pointer('pointerup', 203, 160);
  expect(execute).not.toHaveBeenCalled();

  pointer('pointerdown');
  pointer('pointerup', 202, 160);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls[0]?.[1]).toMatchObject({ board: { center: { x: 101, y: 80 } } });
});

test('switching tools discards a pending placement', () => {
  const { execute, pointer, click, start } = mount();
  start();
  pointer('pointermove');
  fireEvent.keyDown(window, { key: 'h' });
  expect(useSessionStore.getState()).toMatchObject({ toolId: 'pan', preview: null });
  expect(usePlaceStore.getState()).toMatchObject({ request: null, error: null });
  click();
  expect(execute).not.toHaveBeenCalled();
});

test('switching tools discards placement during a temporary pan', () => {
  const { execute, pointer, start } = mount();
  start();
  pointer('pointermove');
  pointer('pointerdown', 200, 160, 1);

  fireEvent.keyDown(window, { key: 'h' });

  expect(useSessionStore.getState()).toMatchObject({ toolId: 'pan', preview: null });
  expect(usePlaceStore.getState()).toMatchObject({ request: null, error: null });
  expect(execute).not.toHaveBeenCalled();
});

test('a rejected placement displays the command error and leaves placement active', () => {
  const { engine, click, start } = mount();
  const before = engine.snapshot();
  start({ mode: 'existing', componentId: 'cmp_missing', footprint: 'area', params: {} });
  click();

  expect(engine.snapshot()).toBe(before);
  expect(usePlaceStore.getState().error).toBe(componentEt.missing);
  expect(useSessionStore.getState().toolId).toBe('components.place');
});
