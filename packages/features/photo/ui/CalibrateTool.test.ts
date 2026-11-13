import { afterEach, expect, test, vi } from 'vitest';
import type { Vec2 } from '@pcbk/domain';
import { useSessionStore, type CanvasPointer, type ToolApi } from '@pcbk/ui';
import { photoUiFixture } from '../__tests__/ui-fixture';
import { CALIBRATE_TOOL_ID, calibrateToolSpec } from './CalibrateTool';
import { useCalibrateStore } from './calibrate-store';
import { photoEt } from './i18n/et';

afterEach(() => {
  useCalibrateStore.getState().reset();
  useSessionStore.getState().reset('');
});

function pointer(world: Vec2, screen: Vec2 = world): CanvasPointer {
  return { world, screen, shift: false, ctrl: false, alt: false };
}

function fixture() {
  const { engine, host } = photoUiFixture();
  const execute = vi.spyOn(engine, 'execute');
  const api: ToolApi = {
    execute,
    snapshot: () => engine.snapshot(),
    sceneTransform: () => 'none',
    hitIndex: { query: () => undefined },
    select: vi.fn(),
    setPreview: vi.fn(),
  };
  const spec = calibrateToolSpec();
  const tool = spec.create();
  const click = (world: Vec2, screen?: Vec2) => {
    const at = pointer(world, screen);
    tool.onPointerDown(at, api);
    tool.onPointerUp(at, api);
  };
  return { api, tool, spec, click, execute, host };
}

test('calibration_clicks_select_world_points_on_photoless_board_without_command', () => {
  const { tool, spec, click, execute, host } = fixture();
  expect(spec).toMatchObject({ id: CALIBRATE_TOOL_ID, key: 'K', group: 'measure' });
  expect(tool.cursor).toBe('crosshair');
  click({ x: 10, y: 20 }, { x: 800, y: 200 });
  expect(useCalibrateStore.getState()).toMatchObject({
    a: { x: 10, y: 20 },
    cursor: { x: 10, y: 20 },
    b: null,
    dialogOpen: false,
  });
  click({ x: 13, y: 24 }, { x: 900, y: 200 });
  expect(useCalibrateStore.getState()).toMatchObject({
    a: { x: 10, y: 20 },
    b: { x: 13, y: 24 },
    dialogOpen: true,
  });
  expect(execute).not.toHaveBeenCalled();
  expect(host.drainJournal()).toEqual([]);
});

test('calibration_too_close_points_wait_for_new_b', () => {
  const { click } = fixture();
  click({ x: 10, y: 20 });
  click({ x: 12, y: 24 });
  expect(useCalibrateStore.getState()).toMatchObject({
    a: { x: 10, y: 20 },
    b: null,
    dialogOpen: false,
    error: photoEt.calibration.tooShort,
  });
  click({ x: 13, y: 24 });
  expect(useCalibrateStore.getState()).toMatchObject({
    b: { x: 13, y: 24 },
    dialogOpen: true,
    error: null,
  });
});

test.each(['move', 'release', 'return'] as const)(
  'calibration_ignores_3_screen_pixel_drag_on_%s',
  (kind) => {
    const { tool, api } = fixture();
    const down = pointer({ x: 10, y: 20 }, { x: 100, y: 100 });
    const moved = pointer({ x: 10.03, y: 20 }, { x: 103, y: 100 });
    tool.onPointerDown(down, api);
    if (kind !== 'release') tool.onPointerMove(moved, api);
    tool.onPointerUp(kind === 'return' ? down : moved, api);
    expect(useCalibrateStore.getState().a).toBeNull();
  },
);

test('calibration_click_below_threshold_uses_release_world_and_updates_preview', () => {
  const { tool, api } = fixture();
  tool.onPointerDown(pointer({ x: 0, y: 0 }, { x: 100, y: 100 }), api);
  const up = pointer({ x: 20, y: 30 }, { x: 102, y: 102 });
  tool.onPointerMove(up, api);
  tool.onPointerUp(up, api);
  expect(useCalibrateStore.getState().a).toEqual({ x: 20, y: 30 });
  tool.onPointerMove(pointer({ x: 80, y: 90 }), api);
  expect(useCalibrateStore.getState().cursor).toEqual({ x: 80, y: 90 });
  expect(useCalibrateStore.getState().b).toBeNull();
});

test('calibration_dialog_blocks_all_pointer_changes', () => {
  const { tool, api, click } = fixture();
  click({ x: 10, y: 20 });
  click({ x: 30, y: 40 });
  const before = useCalibrateStore.getState();
  tool.onPointerMove(pointer({ x: 90, y: 90 }), api);
  click({ x: 80, y: 80 });
  expect(useCalibrateStore.getState()).toBe(before);
});

test('calibration_cancel_discards_draft_and_pending_click_without_changing_next_tool', () => {
  const { tool, api, click, execute } = fixture();
  click({ x: 10, y: 20 });
  tool.onPointerDown(pointer({ x: 30, y: 40 }), api);
  useSessionStore.getState().setToolId('pan');
  tool.onCancel?.(api);
  tool.onPointerUp(pointer({ x: 30, y: 40 }), api);
  expect(useCalibrateStore.getState()).toMatchObject({
    a: null,
    b: null,
    cursor: null,
    error: null,
    dialogOpen: false,
  });
  expect(useSessionStore.getState().toolId).toBe('pan');
  expect(execute).not.toHaveBeenCalled();
});
