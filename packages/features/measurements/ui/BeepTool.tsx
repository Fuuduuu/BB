import { useId, useLayoutEffect, useRef } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { IdGen, Snapshot } from '@pcbk/contracts';
import type { BoardPlacement, MeasuredPin, Vec2 } from '@pcbk/domain';
import { footprintPinIds } from '@pcbk/domain/footprints';
import { boardPads } from '@pcbk/domain/geometry';
import { Button, CanvasHudAnchor, SceneText, useSessionStore, useViewStore } from '@pcbk/ui';
import type { CanvasTool, HitItem, ToolApi, ToolSpec } from '@pcbk/ui';
import { beepGuardSchema, closedBeepTarget, resetBeepTool, useBeepStore } from './beep-store';
import type { ProbePad } from './beep-store';
import { contactFromItem, resolveContact } from './contacts';
import { beepEt as text, commandError, measureEt } from './i18n/et';
import './beep-tool.css';

const toolId = 'measurements.beep';
const getBeep = useBeepStore.getState;
const updateBeep = useBeepStore.setState;
const clearTarget = () => updateBeep(closedBeepTarget);
const moved = (from: Vec2, to: Vec2) => Math.hypot(to.x - from.x, to.y - from.y) >= 3;

function pinPadIds(board: BoardPlacement, pinId: string) {
  // boardPads emits footprint pads in this order, then any custom pad.
  return (footprintPinIds(board.footprint, board.params) ?? []).filter(
    (id) => (board.padMap?.[id] ?? id) === pinId,
  );
}

function clickedPad(snapshot: Snapshot, contact: MeasuredPin, { shape }: HitItem): ProbePad | null {
  const board = resolveContact(snapshot, contact)?.component.board;
  if (!board || (shape.type !== 'point' && shape.type !== 'rect')) return null;
  const index = boardPads(board, [contact.p], snapshot.doc.scale.pxPerMm).findIndex((pad) => {
    if (pad.at.x !== shape.at.x || pad.at.y !== shape.at.y) return false;
    const circular = pad.shape === 'circle' && pad.halfPx.x === pad.halfPx.y;
    return shape.type === 'point'
      ? circular && pad.halfPx.x === shape.r
      : !circular && pad.halfPx.x === shape.half.x && pad.halfPx.y === shape.half.y;
  });
  return index < 0 ? null : (pinPadIds(board, contact.p)[index] ?? index);
}

function probePad(snapshot: Snapshot, contact: MeasuredPin | null, location: ProbePad | null) {
  const found = contact && resolveContact(snapshot, contact);
  const board = found && found.component.board;
  if (!found || !board) return;
  const { component, pin } = found;
  const pads = boardPads(board, [pin.id], snapshot.doc.scale.pxPerMm);
  const index =
    typeof location === 'string' ? pinPadIds(board, pin.id).indexOf(location) : location;
  const pad = pads[index ?? 0] ?? pads[0];
  if (!pad) return;
  const radius = pad.shape === 'rect' ? Math.hypot(pad.halfPx.x, pad.halfPx.y) : pad.radiusPx;
  return { at: pad.at, radius, ref: `${component.ref}.${pin.id}` };
}

function BeepOverlay() {
  const snapshot = useSnapshot((current) => current);
  const { anchor, anchorPad, target, targetPad, guard } = useBeepStore();
  const zoom = useViewStore((state) => state.boardView.zoom);
  const black = probePad(snapshot, anchor, anchorPad);
  const red = probePad(snapshot, guard?.pin ?? target, targetPad);
  if (!black) return null;
  return (
    <g pointerEvents="none">
      <circle
        cx={black.at.x}
        cy={black.at.y}
        r={black.radius + 3 / zoom}
        fill="none"
        stroke="var(--bottom)"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      <SceneText
        x={black.at.x + black.radius + 8 / zoom}
        y={black.at.y - 5 / zoom}
        fontSize={12 / zoom}
        fill="var(--ink)"
        stroke="var(--halo)"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        paintOrder="stroke"
      >
        {text.anchorLabel(black.ref)}
      </SceneText>
      {red && (
        <circle
          cx={red.at.x}
          cy={red.at.y}
          r={red.radius + 2 / zoom}
          fill="none"
          stroke="var(--danger)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

function record(api: ToolApi, ids: IdGen, beep: boolean, connect: boolean) {
  const { anchor, target, guard } = getBeep();
  if (!anchor || !target || guard) return;
  const measurementId = ids.newId('msr');
  updateBeep({ lastMeasurementId: measurementId, error: null });
  const result = api.execute('beep.record', {
    measurementId,
    connectionId: ids.newId('con'),
    anchor,
    pin: target,
    beep,
    connect,
    takenAt: new Date().toISOString(),
  });
  if (!result.ok) {
    updateBeep({ lastMeasurementId: null, error: commandError(result.error) });
    return;
  }
  updateBeep({ target: null });
}

function isBeepKeyOrigin(origin: EventTarget | null): boolean {
  return (
    origin === document.body ||
    (origin instanceof SVGSVGElement && origin.querySelector('[data-scene]') !== null) ||
    (origin instanceof Element && origin.closest('[data-beep-hud]') !== null)
  );
}

function recordNoBeepKey(event: KeyboardEvent, api: ToolApi, ids: IdGen): boolean {
  const { target, guard } = getBeep();
  if (
    event.key.toLowerCase() !== 'n' ||
    event.shiftKey ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !target ||
    guard
  ) {
    return false;
  }
  if (!event.repeat) record(api, ids, false, false);
  return true;
}

function connectGuarded(api: ToolApi, ids: IdGen) {
  const { guard } = getBeep();
  if (!guard) return;
  const { anchor, pin, measurementId } = guard;
  const snapshot = api.snapshot();
  if (
    !resolveContact(snapshot, anchor) ||
    !resolveContact(snapshot, pin) ||
    !snapshot.doc.measurements.some(({ id }) => id === measurementId)
  ) {
    updateBeep({ error: measureEt.errors.missing });
    return;
  }
  const result = api.execute('connections.add', {
    items: [
      {
        id: ids.newId('con'),
        a: { pin: { c: anchor.c, p: anchor.p } },
        b: { pin: { c: pin.c, p: pin.p } },
      },
    ],
    basis: 'assumed',
    skipJoined: false,
  });
  if (result.ok) clearTarget();
  else updateBeep({ error: commandError(result.error) });
}

function Action({
  label,
  shortcut,
  primary,
  run,
}: {
  label: string;
  shortcut: string;
  primary?: boolean;
  run(): void;
}) {
  return (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      aria-keyshortcuts={shortcut === 'Esc' ? 'Escape' : shortcut}
      onClick={run}
    >
      <span>{label}</span>
      <kbd aria-hidden="true">{shortcut}</kbd>
    </Button>
  );
}

function BeepHud({ api, ids }: { api: ToolApi; ids: IdGen }) {
  const engine = useEngine();
  const snapshot = useSnapshot((current) => current);
  const { target, targetAt, targetPad, focusTarget, guard } = useBeepStore();
  const heading = useId();
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(
    () =>
      engine.events((event) => {
        const { lastMeasurementId } = getBeep();
        if (
          event.type !== 'beep.guarded' ||
          event.sessionId !== engine.snapshot().sessionId ||
          lastMeasurementId === null
        ) {
          return;
        }
        const parsed = beepGuardSchema.safeParse(event.payload);
        if (parsed.success && parsed.data.measurementId === lastMeasurementId) {
          updateBeep({ guard: parsed.data });
        }
      }),
    [engine],
  );
  useLayoutEffect(() => {
    if (guard || focusTarget)
      panel.current?.querySelector('button')?.focus({ preventScroll: true });
    if (focusTarget) updateBeep({ focusTarget: false });
  }, [focusTarget, guard]);
  useLayoutEffect(() => {
    if (!target || guard) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (isBeepKeyOrigin(event.target) && recordNoBeepKey(event, api, ids)) event.preventDefault();
    }
    // Only this HUD's N takes precedence over the shell's Navigator shortcut.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [api, guard, ids, target]);

  const contact = guard?.pin ?? target;
  if (!contact) return null;
  const at = probePad(snapshot, contact, targetPad)?.at ?? targetAt;
  if (!at) return null;
  return (
    <CanvasHudAnchor at={at}>
      <div
        ref={panel}
        className="pcbk-beep-hud"
        data-beep-hud=""
        role={guard ? 'dialog' : 'group'}
        aria-label={guard ? undefined : text.tool}
        aria-labelledby={guard ? heading : undefined}
      >
        {guard ? (
          <>
            <p id={heading}>
              {guard.reason === 'role_conflict'
                ? text.roleMerge(guard.roles)
                : text.throughComponent(guard.components)}
            </p>
            <Action
              label={text.connectAnyway}
              shortcut="Enter"
              primary
              run={() => connectGuarded(api, ids)}
            />
            <Action label={text.keepApart} shortcut="Esc" run={clearTarget} />
          </>
        ) : (
          <>
            <Action
              label={text.connect}
              shortcut="Enter"
              primary
              run={() => record(api, ids, true, true)}
            />
            <Action
              label={text.measureOnly}
              shortcut="Shift+Enter"
              run={() => record(api, ids, true, false)}
            />
            <Action label={text.noBeep} shortcut="N" run={() => record(api, ids, false, false)} />
          </>
        )}
      </div>
    </CanvasHudAnchor>
  );
}

function createBeepTool(ids: IdGen): CanvasTool {
  let gesture:
    | { contact: MeasuredPin; pad: ProbePad | null; screen: Vec2; shift: boolean; dragged: boolean }
    | undefined;
  return {
    id: toolId,
    cursor: 'crosshair',
    onPointerDown({ world, screen, shift }, api) {
      const zoom = useViewStore.getState().boardView.zoom;
      const pins = api.hitIndex.queryAll(world, zoom).filter(({ item }) => item.kind === 'pin');
      const hit = (pins.find(({ exact }) => exact) ?? pins[0])?.item;
      const snapshot = api.snapshot();
      const contact = contactFromItem(snapshot, hit);
      gesture =
        hit && contact
          ? { contact, pad: clickedPad(snapshot, contact, hit), screen, shift, dragged: false }
          : undefined;
    },
    onPointerMove({ screen }) {
      if (gesture) gesture.dragged ||= moved(gesture.screen, screen);
    },
    onPointerUp({ screen, world }, api) {
      const finished = gesture;
      gesture = undefined;
      if (!finished || finished.dragged || moved(finished.screen, screen)) return;
      const { contact, pad, shift } = finished;
      if (!resolveContact(api.snapshot(), contact)) return;
      const { anchor } = getBeep();
      if (!anchor || shift) {
        updateBeep({ ...closedBeepTarget, anchor: contact, anchorPad: pad });
      } else if (anchor.uid !== contact.uid) {
        updateBeep({ ...closedBeepTarget, target: contact, targetAt: world, targetPad: pad });
      }
    },
    onKey(event, api) {
      if (event.altKey) return false;
      const { target, guard } = getBeep();
      if (event.key === 'Escape' && !event.shiftKey) {
        if (event.repeat) return true;
        if (target || guard) {
          clearTarget();
          return true;
        }
        resetBeepTool();
        return false;
      }
      if ((!target && !guard) || !isBeepKeyOrigin(event.target)) return false;
      if (event.key === 'Enter') {
        if (event.repeat) return true;
        // Let Enter activate the particular HUD button reached by Tab.
        if (
          !event.shiftKey &&
          event.target instanceof Element &&
          event.target.closest('[data-beep-hud] button')
        ) {
          return false;
        }
        if (guard) {
          if (event.shiftKey) return false;
          connectGuarded(api, ids);
        } else {
          record(api, ids, true, !event.shiftKey);
        }
        return true;
      }
      return recordNoBeepKey(event, api, ids);
    },
    overlay: () => <BeepOverlay />,
    hud: (api) => <BeepHud api={api} ids={ids} />,
    onCancel() {
      gesture = undefined;
      resetBeepTool();
    },
  };
}

export function createBeepToolSpec(ids: IdGen): ToolSpec {
  return {
    id: toolId,
    label: text.tool,
    icon: 'beep',
    key: 'B',
    group: 'measure',
    create: () => createBeepTool(ids),
  };
}

export function BeepHint() {
  const active = useSessionStore((session) => session.toolId === toolId);
  const { anchor, error } = useBeepStore();
  if (!active) return null;
  return (
    <span role="status">
      {anchor ? text.hintNext : text.hintStart}
      {error && ` · ${error}`}
    </span>
  );
}
