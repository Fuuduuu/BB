// @vitest-environment jsdom
import { act, cleanup, fireEvent } from '@testing-library/react';
import { useSessionStore } from '@pcbk/ui';
import { afterEach, expect, test } from 'vitest';
import { mountPlaceTool } from './__tests__/place-tool-helpers';
import { usePlaceStore } from './place-store';

afterEach(() => {
  cleanup();
  usePlaceStore.getState().reset();
  useSessionStore.getState().reset('');
});

function rotate(offset: KeyboardEventInit = {}) {
  return fireEvent.keyDown(window, { key: 'r', ...offset });
}

function outline(svg: SVGSVGElement) {
  return svg.querySelector('[data-placement-ghost] polygon')?.getAttribute('points');
}

test('place_tool_r_rotates_ghost_not_placed_component', () => {
  const { engine, pointer, click, start, svg } = mountPlaceTool();
  start();
  click();
  pointer('pointermove', 400, 260);
  const before = engine.snapshot();
  const originalOutline = outline(svg);
  expect(originalOutline).toBe('190,123.75 210,123.75 210,136.25 190,136.25');

  expect(rotate()).toBe(false);
  expect(engine.snapshot()).toBe(before);
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(0);
  expect(outline(svg)).toBe('206.25,120 206.25,140 193.75,140 193.75,120');
  expect(useSessionStore.getState().preview?.data).toMatchObject({
    center: { x: 200, y: 130 },
    rotationDeg: 90,
  });

  expect(rotate({ repeat: true })).toBe(false);
  for (const modifier of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) rotate(modifier);
  expect(engine.snapshot()).toBe(before);
  expect(useSessionStore.getState().preview?.data).toMatchObject({ rotationDeg: 90 });
  click(400, 260);
  expect(
    engine.snapshot().doc.components.map(({ ref, board }) => [ref, board?.rotationDeg]),
  ).toEqual([
    ['R1', 0],
    ['R2', 90],
  ]);
  expect(useSessionStore.getState().preview?.data).toMatchObject({ rotationDeg: 90 });
  pointer('pointermove', 440, 280);
  expect(useSessionStore.getState().preview?.data).toMatchObject({ rotationDeg: 90 });

  rotate({ key: 'R', shiftKey: true });
  expect(useSessionStore.getState().preview?.data).toMatchObject({ rotationDeg: 0 });
  rotate({ key: 'R', shiftKey: true });
  expect(useSessionStore.getState().preview?.data).toMatchObject({ rotationDeg: 270 });
  start();
  expect(outline(svg)).toBeUndefined();
  pointer('pointermove', 400, 260);
  expect(outline(svg)).toBe(originalOutline);
  expect(useSessionStore.getState().preview?.data).toMatchObject({ rotationDeg: 0 });

  fireEvent.keyDown(window, { key: 'v' });
  expect(outline(svg)).toBeUndefined();
  rotate();
  expect(engine.snapshot().doc.components.map(({ board }) => board?.rotationDeg)).toEqual([0, 180]);
});

test('place_tool_existing_rotation_uses_the_current_scene_and_matches_the_ghost', () => {
  const { engine, pointer, click, start, svg } = mountPlaceTool('rot90');
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
    params: { size: '0805' },
  });
  pointer('pointermove');
  const initial = outline(svg);
  rotate({ key: 'R', shiftKey: true });
  const rotated = outline(svg);
  expect(rotated).not.toBe(initial);
  expect(useSessionStore.getState().preview?.data).toMatchObject({ rotationDeg: 180 });

  click();
  expect(engine.snapshot().doc.components[0]?.board?.rotationDeg).toBe(180);
  expect(svg.querySelector('[data-component="cmp_existing"] polygon')?.getAttribute('points')).toBe(
    rotated,
  );
  expect(usePlaceStore.getState()).toMatchObject({ request: null, rotationOffsetDeg: 0 });
});
