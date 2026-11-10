import type { MeasuredPin, Vec2 } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import type { CanvasTool, ToolSpec } from '@pcbk/ui';
import { contactFromItem, resolveContact } from './contacts';
import { measureEt } from './i18n/et';
import { useMeasureStore } from './measure-store';

export const PICK_REF_TOOL_ID = 'measurements.pickRef';

function passedClickThreshold(start: Vec2, end: Vec2): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= 3;
}

function createPickRefTool(): CanvasTool {
  let gesture: { contact: MeasuredPin; screen: Vec2; dragged: boolean } | undefined;
  return {
    id: PICK_REF_TOOL_ID,
    cursor: 'crosshair',
    onPointerDown({ hit, screen }, api) {
      const contact = contactFromItem(api.snapshot(), hit);
      gesture = contact ? { contact, screen, dragged: false } : undefined;
    },
    onPointerMove({ screen }) {
      if (gesture) gesture.dragged ||= passedClickThreshold(gesture.screen, screen);
    },
    onPointerUp({ screen }, api) {
      const finished = gesture;
      gesture = undefined;
      if (!finished || finished.dragged || passedClickThreshold(finished.screen, screen)) return;
      if (!resolveContact(api.snapshot(), finished.contact)) return;
      useMeasureStore.getState().setBlackProbe(finished.contact);
      useSessionStore.getState().setToolId('select');
    },
    onCancel() {
      gesture = undefined;
    },
  };
}

export function pickRefToolSpec(): ToolSpec {
  return {
    id: PICK_REF_TOOL_ID,
    label: measureEt.pickRef,
    icon: 'pick-ref',
    group: 'measure',
    create: createPickRefTool,
  };
}
