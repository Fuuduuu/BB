import type { Vec2 } from '@pcbk/domain';
import type { CanvasTool, ToolSpec } from '@pcbk/ui';
import { useCalibrateStore } from './calibrate-store';
import { photoEt } from './i18n/et';

export const CALIBRATE_TOOL_ID = 'photo.calibrate';

function passedClickThreshold(start: Vec2, end: Vec2): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= 3;
}

function createCalibrateTool(): CanvasTool {
  let gesture: { screen: Vec2; dragged: boolean } | undefined;
  return {
    id: CALIBRATE_TOOL_ID,
    cursor: 'crosshair',
    onPointerDown({ screen }) {
      if (useCalibrateStore.getState().dialogOpen) return;
      gesture = { screen: { ...screen }, dragged: false };
    },
    onPointerMove({ screen, world }) {
      const store = useCalibrateStore.getState();
      if (store.dialogOpen) return;
      if (gesture) gesture.dragged ||= passedClickThreshold(gesture.screen, screen);
      if (store.a) store.setCursor(world);
    },
    onPointerUp({ screen, world }) {
      const finished = gesture;
      gesture = undefined;
      const store = useCalibrateStore.getState();
      if (
        store.dialogOpen ||
        !finished ||
        finished.dragged ||
        passedClickThreshold(finished.screen, screen)
      )
        return;
      if (!store.a) store.setA(world);
      else if (Math.hypot(world.x - store.a.x, world.y - store.a.y) < 5)
        store.setError(photoEt.calibration.tooShort);
      else store.setB(world);
    },
    onCancel() {
      gesture = undefined;
      useCalibrateStore.getState().reset();
    },
  };
}

export function calibrateToolSpec(): ToolSpec {
  return {
    id: CALIBRATE_TOOL_ID,
    label: photoEt.calibration.tool,
    icon: 'calibrate',
    key: 'K',
    group: 'measure',
    create: createCalibrateTool,
  };
}
