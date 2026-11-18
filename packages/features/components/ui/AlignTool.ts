import type { Vec2 } from '@pcbk/domain';
import { useViewStore } from '@pcbk/ui';
import type { CanvasTool, ToolApi, ToolSpec } from '@pcbk/ui';
import { selectComponent } from '../contract';
import { useAlignStore } from './align-store';
import { alignByTwoPins, hitAlignPin } from './align';
import { commandError } from './errors';
import { alignEt } from './i18n/et';

export const ALIGN_TOOL_ID = 'components.align';

function selectForAlignment(api: ToolApi, id: string) {
  api.select({ items: [{ kind: 'component', id }] });
}

function alignClick(world: Vec2, api: ToolApi) {
  const { stage, advance, reset, setError } = useAlignStore.getState();
  if (stage.step === 2) {
    advance({ ...stage, step: 3, targetA: world });
    return;
  }

  const snapshot = api.snapshot();
  const { pxPerMm } = snapshot.doc.scale;
  const { zoom } = useViewStore.getState().boardView;
  if (stage.step === 1 || stage.step === 3) {
    const hit = api.hitIndex.query(world, zoom);
    if (hit?.kind !== 'pin' || !hit.componentId || !('at' in hit.shape)) {
      setError(alignEt.pickPin);
      return;
    }
    const { id: logicalPin, componentId: id } = hit;
    if (stage.step === 3) {
      if (id !== stage.id) {
        setError(alignEt.sameComponent);
        return;
      }
      if (logicalPin === stage.pinA.id) {
        setError(alignEt.errors.same_pin);
        return;
      }
    }
    const board = selectComponent(snapshot, id)?.board;
    const pin = board && hitAlignPin(board, logicalPin, pxPerMm, hit.shape.at);
    if (!pin) {
      setError(alignEt.pinPosition);
      return;
    }
    if (stage.step === 1) {
      selectForAlignment(api, id);
      advance({ step: 2, id, pinA: pin }, world);
    } else {
      advance({ ...stage, step: 4, pinB: pin }, world);
    }
    return;
  }

  const { id, pinA, pinB, targetA } = stage;
  const board = selectComponent(snapshot, id)?.board;
  if (!board) {
    setError(alignEt.pinPosition);
    return;
  }
  const pose = alignByTwoPins({
    board,
    pxPerMm,
    pinA,
    pinB,
    targetA,
    targetB: world,
    minTargetDistance: 5 / zoom,
  });
  if (!pose.ok) {
    setError(alignEt.errors[pose.reason]);
    return;
  }
  const { center, rotationDeg, scaleX, scaleY } = pose;
  const result = api.execute(ALIGN_TOOL_ID, { id, center, rotationDeg, scaleX, scaleY });
  if (result.ok) {
    reset();
    selectForAlignment(api, id);
  } else {
    setError(commandError(result.error));
  }
}

function moved(start: Vec2, end: Vec2): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= 3;
}

function createAlignTool(): CanvasTool {
  let press: { screen: Vec2; dragged: boolean } | undefined;
  return {
    id: ALIGN_TOOL_ID,
    cursor: 'crosshair',
    onPointerDown({ screen }) {
      press = { screen, dragged: false };
    },
    onPointerMove({ screen, world }) {
      if (press) press.dragged ||= moved(press.screen, screen);
      const { stage, setCursor } = useAlignStore.getState();
      if (stage.step === 2 || stage.step === 4) setCursor(world);
    },
    onPointerUp({ screen, world }, api) {
      const finished = press;
      press = undefined;
      if (!finished || finished.dragged || moved(finished.screen, screen)) return;
      alignClick(world, api);
    },
    onCancel() {
      press = undefined;
      useAlignStore.getState().reset();
    },
  };
}

export function alignToolSpec(): ToolSpec {
  return {
    id: ALIGN_TOOL_ID,
    label: alignEt.tool,
    key: 'A',
    icon: 'align',
    group: 'mechanical',
    create: createAlignTool,
  };
}
