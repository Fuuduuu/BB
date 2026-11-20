// @vitest-environment jsdom
import { componentEt } from './i18n/et';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useSessionStore } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import { center, mountPlaceTool as mount, resistor } from './__tests__/place-tool-helpers';
import { usePlaceStore } from './place-store';
import type { PlacementRequest } from './place-store';

afterEach(() => {
  cleanup();
  usePlaceStore.getState().reset();
  useSessionStore.getState().reset('');
});

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
    board: { footprint: 'chip', params: { size: '0805' }, center, rotationDeg: 0 },
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
    data: {
      footprint: 'chip',
      params: { size: '0805' },
      rotationDeg: 0,
      center: { x: 110, y: 75 },
    },
  });
  expect(execute).not.toHaveBeenCalled();
  expect(engine.snapshot()).toBe(before);
});

test('existing_component_placement_ends_after_one', () => {
  const { engine, execute, click, pointer, start } = mount();
  act(() =>
    engine.execute('components.add', {
      id: 'cmp_existing',
      kind: 'resistor',
      pins: [
        { id: '1', uid: 'pin_existing1' },
        { id: '2', uid: 'pin_existing2' },
      ],
    }),
  );
  start({
    mode: 'existing',
    componentId: 'cmp_existing',
    footprint: 'chip',
    params: resistor.params,
  });
  pointer('pointermove');
  click();

  expect(useSessionStore.getState()).toMatchObject({
    selection: { items: [{ kind: 'component', id: 'cmp_existing' }] },
    toolId: 'select',
    preview: null,
  });
  expect(usePlaceStore.getState()).toMatchObject({ request: null, error: null });
  click(300, 200);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(engine.snapshot().doc.components).toHaveLength(1);
});

test.each<{
  footprint: string;
  params: Extract<PlacementRequest, { mode: 'existing' }>['params'];
  pinIds: string[];
}>([
  { footprint: 'chip', params: { size: '0805' }, pinIds: ['2', '1'] },
  { footprint: 'area', params: { w: 4, h: 8 }, pinIds: ['PWR', 'GND'] },
])('place_existing_keeps_pin_uids ($footprint)', ({ footprint, params, pinIds }) => {
  const { engine, execute, click, start } = mount();
  const id = 'cmp_existing';
  const pins = pinIds.map((pinId, index) => ({ id: pinId, uid: `pin_${index}` }));
  act(() => engine.execute('components.add', { id, kind: 'other', pins }));
  const board = { footprint, params, center };
  act(() => engine.execute('components.placeOnBoard', { id, board }));
  act(() => engine.execute('components.removeFromBoard', { ids: [id] }));
  expect(engine.snapshot().doc.components[0]?.board).toBeUndefined();
  const before = engine.snapshot().doc.components[0]?.pins;

  start({ mode: 'existing', componentId: id, footprint, params });
  click();

  expect(execute).toHaveBeenCalledExactlyOnceWith('components.placeOnBoard', {
    id,
    board: { ...board, rotationDeg: 0 },
  });
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

// Literal scene matrices keep the orientation expectation independent of the helpers.
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

test('new_component_upright_on_screen_under_all_8_transforms', () => {
  for (const transform of Object.keys(transforms) as SceneTransform[]) {
    for (const mode of ['new', 'existing'] as const) {
      const { engine, svg, pointer, click, start } = mount(transform);
      if (mode === 'existing')
        act(() => {
          engine.execute('components.add', {
            id: 'cmp_existing',
            kind: 'resistor',
            pins: [
              { id: '1', uid: 'pin_existing1' },
              { id: '2', uid: 'pin_existing2' },
            ],
          });
        });
      start(
        mode === 'new'
          ? resistor
          : {
              mode,
              componentId: 'cmp_existing',
              footprint: 'chip',
              params: { size: '0805' },
            },
      );
      pointer('pointermove');
      const preview = svg
        .querySelector('[data-layer="components.bodies"] polygon')!
        .getAttribute('points');
      click();
      expect(
        engine.snapshot().doc.components,
        `${transform}/${mode}: ${usePlaceStore.getState().error}`,
      ).toHaveLength(1);
      const board = engine.snapshot().doc.components[0]!.board!;
      expect(board, `${transform}/${mode}: ${usePlaceStore.getState().error}`).toBeDefined();
      const angle = (board.rotationDeg * Math.PI) / 180;
      const [a, b, c, d] = transforms[transform];
      const up = { x: Math.sin(angle), y: -Math.cos(angle) };
      expect(a * up.x + c * up.y, `${transform}/${mode}: screen up x`).toBeCloseTo(0);
      expect(b * up.x + d * up.y, `${transform}/${mode}: screen up y`).toBeCloseTo(-1);
      expect(board.side).toBe('top');
      expect(
        svg.querySelector('[data-layer="components.bodies"] polygon')!.getAttribute('points'),
      ).toBe(preview);
      cleanup();
      useSessionStore.getState().reset('');
    }
  }
});
