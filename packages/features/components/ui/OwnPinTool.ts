import type { IdGen } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { boardToPad } from '@pcbk/domain/geometry';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import type { CanvasTool, ToolApi, ToolSpec } from '@pcbk/ui';
import { create } from 'zustand';
import { selectComponent } from '../contract';
import { commandError } from './errors';
import { componentEt } from './i18n/et';
import { nextPinId, ownPadSizeMm, ownPinTarget } from './own-pin';

export const OWN_PIN_TOOL_ID = 'components.addOwnPin';

export const useOwnPinError = create<{
  error: string | null;
  setError(error: string | null): void;
}>((set) => ({
  error: null,
  setError: (error) => set({ error }),
}));

function addOwnPinAt(world: Vec2, api: ToolApi, ids: IdGen) {
  const snapshot = api.snapshot();
  const { setError } = useOwnPinError.getState();
  const target = ownPinTarget(snapshot, useSessionStore.getState().selection);
  if (!target) {
    const { zoom } = useViewStore.getState().boardView;
    const hit = api.hitIndex.query(world, zoom);
    const id = hit?.kind === 'component' ? hit.id : hit?.componentId;
    if (id !== undefined && selectComponent(snapshot, id)?.board) {
      api.select({ items: [{ kind: 'component', id }] });
    }
    setError(null);
    return;
  }

  const pinId = nextPinId(target.pins);
  const result = api.execute(OWN_PIN_TOOL_ID, {
    id: target.id,
    pin: { id: pinId, uid: ids.newId('pin') },
    local: boardToPad(target.board, world, snapshot.doc.scale.pxPerMm),
    sizeMm: ownPadSizeMm(target.board),
  });
  setError(result.ok ? null : commandError(result.error));
  if (result.ok) api.select({ items: [{ kind: 'pin', componentId: target.id, id: pinId }] });
}

function moved(start: Vec2, end: Vec2): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= 3;
}

function createOwnPinTool(ids: IdGen): CanvasTool {
  let press: { screen: Vec2; dragged: boolean } | undefined;
  return {
    id: OWN_PIN_TOOL_ID,
    cursor: 'crosshair',
    onPointerDown({ screen }) {
      press = { screen, dragged: false };
    },
    onPointerMove({ screen }) {
      if (press) press.dragged ||= moved(press.screen, screen);
    },
    onPointerUp({ screen, world }, api) {
      const finished = press;
      press = undefined;
      if (!finished || finished.dragged || moved(finished.screen, screen)) return;
      addOwnPinAt(world, api, ids);
    },
    onCancel() {
      press = undefined;
      useOwnPinError.getState().setError(null);
    },
  };
}

export function ownPinToolSpec(ids: IdGen): ToolSpec {
  return {
    id: OWN_PIN_TOOL_ID,
    label: componentEt.addPin,
    key: 'J',
    icon: 'add-pin',
    group: 'mechanical',
    create: () => createOwnPinTool(ids),
  };
}
