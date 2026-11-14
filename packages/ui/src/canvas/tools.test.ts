// @vitest-environment jsdom
import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { expect, test, vi } from 'vitest';
import { newBoardDoc } from '../../../domain/src/doc';
import type { Preview, Selection } from '../shell/session-store';
import type { HitItem } from './hit-index';
import { createPanToolSpec } from './PanTool';
import { createSelectToolSpec } from './SelectTool';
import type { CanvasPointer, ToolApi } from './tools';

const component = { kind: 'component', id: 'cmp_r1' } as const;
const componentHit: HitItem = {
  ...component,
  shape: {
    type: 'area',
    polygon: [
      { x: 18, y: 27 },
      { x: 25, y: 27 },
      { x: 25, y: 32 },
      { x: 18, y: 32 },
    ],
  },
};
const pinHit: HitItem = {
  kind: 'pin',
  id: 'pin_r1_1',
  componentId: component.id,
  shape: { type: 'point', at: { x: 20, y: 30 }, r: 1 },
};

function pointer(screen: Vec2, world: Vec2, hit?: HitItem): CanvasPointer {
  return { screen, world, hit, shift: false, alt: false, ctrl: false };
}

function setup(initialSelection: Selection = { items: [] }, unplacedBoard: string[] = []) {
  let selection = initialSelection;
  let preview: Preview | null = null;
  const execute = vi.fn<ToolApi['execute']>(() => ({ ok: true, value: { rev: 1 } }));
  const snapshot: Snapshot = {
    sessionId: 'board',
    rev: 0,
    doc: newBoardDoc('Plaat'),
    derived: { unplacedBoard, unplacedSchematic: [], pinReadings: {} },
    history: { canUndo: false, canRedo: false },
  };
  const api: ToolApi = {
    execute,
    select: (next) => (selection = next),
    setPreview: (next) => (preview = next),
    hitIndex: { query: () => undefined },
    snapshot: () => snapshot,
    sceneTransform: () => 'none',
  };
  const selectTool = createSelectToolSpec(() => selection).create();
  return { api, execute, selectTool, selection: () => selection, preview: () => preview };
}

test('click_selects_component_then_pin', () => {
  const { api, selection, selectTool, execute } = setup();
  const start = { x: 100, y: 100 };
  const world = { x: 20, y: 30 };

  selectTool.onPointerDown(pointer(start, world, componentHit), api);
  expect(selection()).toEqual({ items: [component] });
  selectTool.onPointerUp(pointer(start, world, componentHit), api);
  expect(selection()).toEqual({ items: [component] });

  selectTool.onPointerDown(pointer(start, world, pinHit), api);
  expect(selection()).toEqual({ items: [component] });
  selectTool.onPointerUp(pointer(start, world, pinHit), api);
  expect(selection()).toEqual({
    items: [{ kind: 'pin', id: 'pin_r1_1', componentId: 'cmp_r1' }],
  });

  selectTool.onPointerDown(pointer(start, world), api);
  selectTool.onPointerUp(pointer(start, world), api);
  expect(selection()).toEqual({ items: [] });
  expect(execute).not.toHaveBeenCalled();
});

test('drag_below_3px_is_a_click', () => {
  const { api, selection, selectTool, execute, preview } = setup({ items: [component] });
  const down = pointer({ x: 100, y: 100 }, { x: 20, y: 30 }, pinHit);
  const up = pointer({ x: 102, y: 102 }, { x: 40, y: 50 });

  selectTool.onPointerDown(down, api);
  selectTool.onPointerMove(up, api);
  expect(preview()).toBeNull();
  selectTool.onPointerUp(up, api);

  expect(selection()).toEqual({ items: [{ kind: 'pin', id: 'pin_r1_1', componentId: 'cmp_r1' }] });
  expect(execute).not.toHaveBeenCalled();
});

test('drag_grab_offset_stays_under_cursor', () => {
  const { api, selectTool, execute, preview } = setup({ items: [component] });
  const down = pointer({ x: 50, y: 50 }, { x: 22, y: 29 }, componentHit);
  const move = pointer({ x: 53, y: 50 }, { x: 20.5, y: 29 });

  selectTool.onPointerDown(down, api);
  selectTool.onPointerMove(move, api);

  expect(preview()).toEqual({ owner: 'select', data: { items: [component], dx: -1.5, dy: 0 } });
  expect(execute).not.toHaveBeenCalled();
});

test('drag_commits_one_translate_on_pointerup', () => {
  const { api, selectTool, execute, selection, preview } = setup({ items: [component] });
  selectTool.onPointerDown(pointer({ x: 50, y: 50 }, { x: 22, y: 29 }, componentHit), api);
  selectTool.onPointerMove(pointer({ x: 56, y: 52 }, { x: 25, y: 30 }), api);
  selectTool.onPointerMove(pointer({ x: 58, y: 50 }, { x: 26, y: 29 }), api);
  expect(execute).not.toHaveBeenCalled();

  const up = pointer({ x: 60, y: 46 }, { x: 27, y: 27 });
  selectTool.onPointerUp(up, api);
  selectTool.onPointerUp(up, api);

  expect(execute.mock.calls).toEqual([['items.translate', { items: [component], dx: 5, dy: -2 }]]);
  expect(preview()).toBeNull();
  expect(selection()).toEqual({ items: [component] });
});

test('dragging_empty_space_leaves_selection_unchanged', () => {
  const { api, selectTool, selection, preview, execute } = setup({ items: [component] });
  const down = pointer({ x: 50, y: 50 }, { x: 22, y: 29 });
  const move = pointer({ x: 60, y: 50 }, { x: 32, y: 29 });

  selectTool.onPointerDown(down, api);
  selectTool.onPointerMove(move, api);
  selectTool.onPointerUp(down, api);

  expect(selection()).toEqual({ items: [component] });
  expect(preview()).toBeNull();
  expect(execute).not.toHaveBeenCalled();
});

test('cancelled_drag_leaves_no_trace', () => {
  const { api, selectTool, execute, preview, selection } = setup({ items: [component] });
  const down = pointer({ x: 50, y: 50 }, { x: 22, y: 29 }, componentHit);
  const move = pointer({ x: 54, y: 50 }, { x: 26, y: 29 });
  selectTool.onPointerDown(down, api);
  selectTool.onPointerMove(move, api);
  expect(preview()).not.toBeNull();

  selectTool.onCancel?.(api);
  selectTool.onPointerMove(move, api);
  selectTool.onPointerUp(move, api);

  expect(preview()).toBeNull();
  expect(execute).not.toHaveBeenCalled();
  expect(selection()).toEqual({ items: [component] });
});

test('custom_hit_drag_previews_and_commits_its_final_world_delta', () => {
  const { api, selectTool, execute, preview, selection } = setup();
  const commit = vi.fn();
  const hit: HitItem = {
    ...componentHit,
    drag: { owner: 'test.label', commit },
  };
  const down = pointer({ x: 50, y: 50 }, { x: 22, y: 29 }, hit);
  const move = pointer({ x: 54, y: 50 }, { x: 24, y: 29 });
  const up = pointer({ x: 56, y: 46 }, { x: 25, y: 27 });

  selectTool.onPointerDown(down, api);
  selectTool.onPointerMove(move, api);
  expect(selection()).toEqual({ items: [] });
  expect(preview()).toEqual({ owner: 'test.label', data: { id: component.id, dx: 2, dy: 0 } });
  expect(commit).not.toHaveBeenCalled();

  selectTool.onPointerUp(up, api);
  selectTool.onPointerUp(up, api);
  expect(preview()).toBeNull();
  expect(commit).toHaveBeenCalledExactlyOnceWith({ x: 3, y: -2 }, api);
  expect(execute).not.toHaveBeenCalled();
});

test('custom_hit_click_selects_its_target', () => {
  const { api, selectTool, selection } = setup();
  const commit = vi.fn();
  const label: HitItem = {
    ...componentHit,
    kind: 'component-label',
    target: component,
    drag: { owner: 'test.label', commit },
  };
  const down = pointer({ x: 50, y: 50 }, { x: 22, y: 29 }, label);

  selectTool.onPointerDown(down, api);
  expect(selection()).toEqual({ items: [] });
  selectTool.onPointerUp(down, api);
  expect(selection()).toEqual({ items: [component] });
  expect(commit).not.toHaveBeenCalled();
});

test('arrow_keys_nudge_with_one_command_each', () => {
  const { api, selectTool, execute } = setup({ items: [component] });
  expect(selectTool.onKey?.(new KeyboardEvent('keydown', { key: 'ArrowLeft' }), api)).toBe(true);
  expect(
    selectTool.onKey?.(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }), api),
  ).toBe(true);
  expect(
    selectTool.onKey?.(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }), api),
  ).toBe(false);
  expect(
    selectTool.onKey?.(new KeyboardEvent('keydown', { key: 'ArrowLeft', repeat: true }), api),
  ).toBe(true);

  expect(execute.mock.calls).toEqual([
    ['items.translate', { items: [component], dx: -1, dy: 0 }],
    ['items.translate', { items: [component], dx: 0, dy: 10 }],
  ]);
});

test('arrow_keys_ignore_an_unplaced_component', () => {
  const { api, selectTool, execute } = setup({ items: [component] }, [component.id]);

  expect(selectTool.onKey?.(new KeyboardEvent('keydown', { key: 'ArrowRight' }), api)).toBe(false);
  expect(execute).not.toHaveBeenCalled();
});

test('pan_uses_screen_deltas_through_release_and_stops_after_cancel', () => {
  const { api, execute, selection } = setup({ items: [component] });
  const panByScreen = vi.fn<(delta: Vec2) => void>();
  const panTool = createPanToolSpec(panByScreen).create();
  const down = pointer({ x: 50, y: 50 }, { x: 22, y: 29 }, componentHit);
  const move = pointer({ x: 54, y: 51 }, { x: 20, y: 29 });
  const up = pointer({ x: 52, y: 56 }, { x: 21, y: 23 });

  panTool.onPointerDown(down, api);
  panTool.onPointerMove(move, api);
  panTool.onPointerUp(up, api);
  expect(panByScreen.mock.calls).toEqual([[{ x: 4, y: 1 }], [{ x: -2, y: 5 }]]);

  panTool.onPointerDown(down, api);
  panTool.onCancel?.(api);
  panTool.onPointerMove(move, api);
  panTool.onPointerUp(up, api);
  expect(panByScreen).toHaveBeenCalledTimes(2);
  expect(selection()).toEqual({ items: [component] });
  expect(execute).not.toHaveBeenCalled();
});
