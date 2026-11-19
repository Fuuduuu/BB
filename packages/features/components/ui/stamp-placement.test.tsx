// @vitest-environment jsdom
import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useSessionStore } from '@pcbk/ui';
import { mountPlaceTool, resistor } from './__tests__/place-tool-helpers';
import { usePlaceStore } from './place-store';

afterEach(() => {
  cleanup();
  usePlaceStore.getState().reset();
  useSessionStore.getState().reset('');
});

test('place_tool_stays_armed_until_escape', () => {
  const { engine, click, start } = mountPlaceTool();
  start();
  click(200, 160);
  click(300, 200);
  click(400, 240);

  expect(engine.snapshot().doc.components.map(({ ref }) => ref)).toEqual(['R1', 'R2', 'R3']);
  expect(useSessionStore.getState()).toMatchObject({
    toolId: 'components.place',
    selection: { items: [{ kind: 'component', id: 'cmp_7' }] },
  });
  expect(usePlaceStore.getState().request).toEqual(resistor);

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useSessionStore.getState()).toMatchObject({ toolId: 'select', preview: null });
  expect(usePlaceStore.getState()).toMatchObject({ request: null, error: null });
  click(500, 280);
  expect(engine.snapshot().doc.components).toHaveLength(3);
});

test('each_stamp_is_one_undo_step', () => {
  const { engine, click, start } = mountPlaceTool();
  start();
  click(200, 160);
  click(300, 200);
  click(400, 240);

  expect(engine.snapshot().doc.components.map(({ ref }) => ref)).toEqual(['R1', 'R2', 'R3']);
  act(() => expect(engine.undo().ok).toBe(true));
  expect(engine.snapshot().doc.components.map(({ ref }) => ref)).toEqual(['R1', 'R2']);
  act(() => expect(engine.undo().ok).toBe(true));
  expect(engine.snapshot().doc.components.map(({ ref }) => ref)).toEqual(['R1']);
});

test('preview_stays_after_stamp', () => {
  const { engine, svg, pointer, click, start } = mountPlaceTool();
  start();
  pointer('pointermove', 180, 140);
  click(200, 160);

  expect(engine.snapshot().doc.components[0]?.board?.center).toEqual({ x: 100, y: 80 });
  expect(useSessionStore.getState().preview).toEqual({
    owner: 'components.place',
    data: {
      footprint: 'chip',
      params: { size: '0805' },
      rotationDeg: 0,
      center: { x: 100, y: 80 },
    },
  });
  const outline = svg.querySelector('[data-layer="components.bodies"] [stroke-dasharray]');
  expect(outline?.getAttribute('points')).toBe('90,73.75 110,73.75 110,86.25 90,86.25');
  pointer('pointermove', 240, 200);
  expect(useSessionStore.getState().preview?.data).toMatchObject({ center: { x: 120, y: 100 } });
  expect(engine.snapshot().doc.components).toHaveLength(1);
});
