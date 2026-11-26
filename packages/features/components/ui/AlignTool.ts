import { createElement } from 'react';
import type { Vec2 } from '@pcbk/domain';
import { pinSpacingMm } from '@pcbk/domain/rules';
import { isToolKeyOrigin, pickHit, useViewStore } from '@pcbk/ui';
import type { CanvasTool, ToolApi, ToolSpec } from '@pcbk/ui';
import { selectComponent } from '../contract';
import { useAlignStore } from './align-store';
import { AlignScaleQuestion } from './AlignScaleQuestion';
import { alignByTwoPins, hitAlignPin, scaleBasisKey } from './align';
import { commandError } from './errors';
import { alignEt } from './i18n/et';

export const ALIGN_TOOL_ID = 'components.align';

function selectForAlignment(api: ToolApi, id: string) {
  api.select({ items: [{ kind: 'component', id }] });
}

function applyComponentScale(api: ToolApi) {
  const { stage, reset, setError } = useAlignStore.getState();
  if (stage.step !== 5) return;
  const { id, pinA, pinB, targetA, targetB, mm, basis } = stage;
  const board = selectComponent(api.snapshot(), id)?.board;
  if (!board || scaleBasisKey(board) !== basis) {
    reset();
    return;
  }
  const result = api.execute('components.scaleFromPins', { id, pinA, pinB, targetA, targetB, mm });
  reset();
  if (result.ok) selectForAlignment(api, id);
  else setError(commandError(result.error));
}

function alignClick(world: Vec2, api: ToolApi) {
  const { stage: current, advance, reset, setError } = useAlignStore.getState();
  if (current.step === 5) reset();
  const stage = current.step === 5 ? ({ step: 1 } as const) : current;
  if (stage.step === 2) {
    advance({ ...stage, step: 3, targetA: world });
    return;
  }

  const snapshot = api.snapshot();
  const { pxPerMm, calibrated } = snapshot.doc.scale;
  const { zoom } = useViewStore.getState().boardView;
  if (stage.step === 1 || stage.step === 3) {
    const hit = pickHit(api.hitIndex, world, zoom, 'pin');
    if (!hit?.componentId) {
      setError(alignEt.pickPin);
      return;
    }
    if (!('at' in hit.shape)) {
      setError(alignEt.pinPosition);
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
  const mm = pinSpacingMm(board, pinA, pinB);
  const distance = Math.hypot(world.x - targetA.x, world.y - targetA.y);
  const question =
    mm !== undefined && mm > 0 && distance >= 5
      ? ({
          ...stage,
          step: 5,
          targetB: world,
          ratio: distance / (mm * pxPerMm),
          uncalibrated: calibrated === false,
          mm,
          basis: scaleBasisKey(board),
        } as const)
      : undefined;
  const proposed = question && distance / question.mm;
  const canUseScale = proposed !== undefined && proposed >= 0.1 && proposed <= 1000;
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
    if (pose.reason === 'scale_out_of_range' && question && canUseScale) advance(question);
    else setError(alignEt.errors[pose.reason]);
    return;
  }
  const { center, rotationDeg, scaleX, scaleY } = pose;
  const result = api.execute(ALIGN_TOOL_ID, { id, center, rotationDeg, scaleX, scaleY });
  if (!result.ok) {
    setError(commandError(result.error));
    return;
  }
  selectForAlignment(api, id);
  const shouldOffer =
    question !== undefined &&
    (question.uncalibrated || question.ratio < 0.8 || question.ratio > 1.25);
  if (shouldOffer && canUseScale) {
    advance(question);
    return;
  }
  reset();
  if (shouldOffer) setError(alignEt.scaleOutOfRange);
}

function moved(start: Vec2, end: Vec2): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= 3;
}

function createAlignTool(): CanvasTool {
  let press: { screen: Vec2; dragged: boolean } | undefined;
  return {
    id: ALIGN_TOOL_ID,
    cursor: 'crosshair',
    hud: (api, snapshot) =>
      createElement(AlignScaleQuestion, { snapshot, onUse: () => applyComponentScale(api) }),
    onKey(event, api) {
      if (useAlignStore.getState().stage.step !== 5 || event.key !== 'Enter') return false;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
      if (!isToolKeyOrigin(event.target, '[data-align-question]')) return false;
      if (event.repeat) return true;
      if (event.target instanceof Element && event.target.closest('[data-align-question] button')) {
        return false;
      }
      applyComponentScale(api);
      return true;
    },
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
