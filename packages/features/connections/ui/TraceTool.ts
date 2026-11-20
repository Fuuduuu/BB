import type { IdGen, Snapshot } from '@pcbk/contracts';
import type { EndRef, Vec2 } from '@pcbk/domain';
import { branchConnection, endAcceptsDrawing, endKey, RuleRejected } from '@pcbk/domain/rules';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import type { CanvasPointer, CanvasTool, ToolApi, ToolSpec } from '@pcbk/ui';
import { createElement } from 'react';
import { TRACE_WIDTH_MM, WIRE_WIDTH_MM } from '../contract';
import { connectionEndpoint } from './connection-geometry';
import { connectionsEt } from './i18n/et';
import { distance, drawingHit, endpointHit, snappedWaypoint } from './trace-geometry';
import type { Drawing, DrawingHit, EndpointHit } from './trace-geometry';
import { resetTraceTool, TRACE_TOOL_ID, useTraceStore } from './trace-store';
import type { TraceDraft, TraceMode } from './trace-store';
import { TraceOverlay } from './TraceOverlay';

export { resetTraceTool } from './trace-store';

type Doc = Snapshot['doc'];
type Target =
  | { kind: 'end'; hit: EndpointHit; at: Vec2; accepted: boolean }
  | { kind: 'branch'; hit: DrawingHit; at: Vec2; accepted: boolean };

const getTrace = useTraceStore.getState;
const updateTrace = useTraceStore.setState;
const zoomNow = () => useViewStore.getState().boardView.zoom;
const clickRadius = 3;

function drawing(mode: TraceMode, waypoints: Vec2[]): Drawing {
  const widthMm = mode.kind === 'trace' ? TRACE_WIDTH_MM : WIRE_WIDTH_MM;
  return { ...mode, waypoints, widthMm };
}

function accepts(doc: Doc, end: EndRef, mode: TraceMode) {
  return endAcceptsDrawing(doc, end, mode.kind, mode.layer);
}

function startMode(doc: Doc, start: EndRef, mode: TraceMode): TraceMode {
  if (mode.kind === 'wire' || !('pin' in start) || accepts(doc, start, mode)) return mode;
  const side = doc.components.find(({ id }) => id === start.pin.c)?.board?.side;
  return side ? { kind: 'trace', layer: side } : mode;
}

function nextMode(mode: TraceMode): TraceMode {
  if (mode.kind === 'wire') return { kind: 'trace', layer: 'top' };
  if (mode.layer === 'top') return { kind: 'trace', layer: 'bottom' };
  return { kind: 'wire', layer: mode.layer };
}

function savedConnection(doc: Doc, id: string) {
  return doc.connections.find((connection) => connection.id === id && !connection.board);
}

function begin(doc: Doc, start: EndRef, existingId?: string) {
  const mode = startMode(doc, start, getTrace().mode);
  const at = connectionEndpoint(doc, start);
  updateTrace({
    mode,
    draft: { start, waypoints: [], existingId },
    preview: at ? { points: [at], pxPerMm: doc.scale.pxPerMm, zoom: zoomNow() } : null,
    error: null,
  });
}

export function startExistingTrace(api: ToolApi, id: string): boolean {
  const { doc } = api.snapshot();
  const connection = savedConnection(doc, id);
  if (
    !connection ||
    !connectionEndpoint(doc, connection.a) ||
    !connectionEndpoint(doc, connection.b)
  ) {
    return false;
  }
  begin(doc, connection.a, connection.id);
  useSessionStore.getState().setToolId(TRACE_TOOL_ID);
  return true;
}

function branchInput(hit: DrawingHit, draft: TraceDraft, board: Drawing, ids?: IdGen) {
  const junctionId = ids?.newId('jun') ?? '';
  return {
    target: hit.id,
    segment: hit.segment,
    at: hit.at,
    junctionId,
    splitId: ids?.newId('con') ?? '',
    trace: { id: ids?.newId('con') ?? '', a: draft.start, b: { junction: junctionId }, board },
  };
}

function acceptsBranch(doc: Doc, hit: DrawingHit, draft: TraceDraft, mode: TraceMode) {
  try {
    branchConnection(doc, branchInput(hit, draft, drawing(mode, draft.waypoints)));
    return true;
  } catch (error) {
    if (error instanceof RuleRejected) return false;
    throw error;
  }
}

function findTarget(
  doc: Doc,
  event: CanvasPointer,
  draft: TraceDraft,
  mode: TraceMode,
): Target | undefined {
  const endpoint = endpointHit(doc, event.hit);
  if (endpoint && endKey(endpoint.end) !== endKey(draft.start)) {
    const existing = draft.existingId ? savedConnection(doc, draft.existingId) : undefined;
    if (draft.existingId && (!existing || endKey(endpoint.end) !== endKey(existing.b))) return;
    const at = connectionEndpoint(doc, endpoint.end);
    if (at) {
      return {
        kind: 'end',
        hit: endpoint,
        at,
        accepted: accepts(doc, draft.start, mode) && accepts(doc, endpoint.end, mode),
      };
    }
  }
  if (draft.existingId) return;
  const trace = drawingHit(doc, event.hit, event.world);
  if (trace) {
    return {
      kind: 'branch',
      hit: trace,
      at: trace.at,
      accepted: acceptsBranch(doc, trace, draft, mode),
    };
  }
}

function cursorPoint(event: CanvasPointer, from: Vec2, target: Target | undefined): Vec2 {
  if (target) return target.accepted ? target.at : event.world;
  return event.shift ? snappedWaypoint(from, event.world) : event.world;
}

function updateOverlay(doc: Doc, event?: CanvasPointer) {
  const { draft, mode } = getTrace();
  const start = draft && connectionEndpoint(doc, draft.start);
  if (!draft || !start) {
    updateTrace({ preview: null });
    return;
  }
  const zoom = zoomNow();
  const target = event && findTarget(doc, event, draft, mode);
  const points = [start, ...draft.waypoints];
  const cursor = event && cursorPoint(event, points.at(-1)!, target);
  updateTrace({
    preview: {
      points,
      cursor,
      pxPerMm: doc.scale.pxPerMm,
      zoom,
      ...(target?.accepted ? { target: target.hit } : {}),
    },
  });
}

function finish(result: ReturnType<ToolApi['execute']>) {
  if (result.ok) {
    updateTrace({ draft: null, preview: null, error: null });
    return;
  }
  const layerMismatch =
    result.error.code === 'validation' &&
    result.error.issues.some(({ message }) => message === 'layer_mismatch');
  updateTrace({
    error: layerMismatch ? connectionsEt.traceLayerMismatch : connectionsEt.traceFailed,
  });
}

function commitEndpoint(api: ToolApi, ids: IdGen, draft: TraceDraft, end: EndRef, board: Drawing) {
  const { doc } = api.snapshot();
  const a = endKey(draft.start);
  const b = endKey(end);
  const existing = doc.connections.find((connection) => {
    if (connection.board) return false;
    const start = endKey(connection.a);
    const finish = endKey(connection.b);
    return (start === a && finish === b) || (start === b && finish === a);
  });
  if (existing) {
    const waypoints = endKey(existing.a) === a ? board.waypoints : [...board.waypoints].reverse();
    finish(
      api.execute('connections.drawOnBoard', { id: existing.id, board: { ...board, waypoints } }),
    );
    return;
  }
  const item = { id: ids.newId('con'), a: draft.start, b: end, board };
  finish(api.execute('connections.add', { items: [item], basis: 'visual', skipJoined: false }));
}

function commitOpenEnd(api: ToolApi, ids: IdGen, draft: TraceDraft, board: Drawing, at: Vec2) {
  const junction = ids.newId('jun');
  const item = { id: ids.newId('con'), a: draft.start, b: { junction }, board };
  finish(
    api.execute('connections.add', {
      items: [item],
      basis: 'visual',
      skipJoined: false,
      junctions: [{ id: junction, board: { at, layer: board.layer } }],
    }),
  );
}

function advanceTrace(api: ToolApi, event: CanvasPointer, ids: IdGen) {
  const { doc } = api.snapshot();
  const { draft, mode } = getTrace();
  if (!draft) {
    const hit = endpointHit(doc, event.hit);
    if (hit && connectionEndpoint(doc, hit.end)) {
      begin(doc, hit.end);
      if (!accepts(doc, hit.end, getTrace().mode)) {
        updateTrace({ error: connectionsEt.traceLayerMismatch });
      }
    }
    return;
  }
  const start = connectionEndpoint(doc, draft.start);
  if (!start) {
    updateTrace({ draft: null, preview: null });
    return;
  }

  const zoom = zoomNow();
  const target = findTarget(doc, event, draft, mode);
  const last = draft.waypoints.at(-1);
  const repeatsLast = last !== undefined && distance(last, event.world) * zoom <= clickRadius;
  const board = drawing(mode, draft.waypoints);
  if (draft.existingId && (target || repeatsLast)) {
    finish(api.execute('connections.drawOnBoard', { id: draft.existingId, board }));
  } else if (target?.kind === 'end' && target.accepted) {
    commitEndpoint(api, ids, draft, target.hit.end, board);
  } else if (target?.kind === 'branch' && target.accepted) {
    finish(api.execute('connections.branch', branchInput(target.hit, draft, board, ids)));
  } else if (target) {
    commitOpenEnd(api, ids, draft, board, event.world);
  } else if (repeatsLast) {
    commitOpenEnd(api, ids, draft, { ...board, waypoints: draft.waypoints.slice(0, -1) }, last);
  } else {
    const point = cursorPoint(event, last ?? start, undefined);
    if (distance(point, last ?? start) === 0) return;
    updateTrace({ draft: { ...draft, waypoints: [...draft.waypoints, point] }, error: null });
    updateOverlay(doc);
  }
}

function createTraceTool(ids: IdGen): CanvasTool {
  let down: Vec2 | undefined;
  let cursor: CanvasPointer | undefined;
  let dragged = false;
  return {
    id: TRACE_TOOL_ID,
    cursor: 'crosshair',
    onPointerDown(event) {
      down = event.screen;
      dragged = false;
    },
    onPointerMove(event, api) {
      cursor = event;
      if (down && distance(down, event.screen) > clickRadius) dragged = true;
      if (getTrace().draft) updateOverlay(api.snapshot().doc, event);
    },
    onPointerUp(event, api) {
      const click = down && !dragged && distance(down, event.screen) <= clickRadius;
      cursor = event;
      down = undefined;
      if (click) advanceTrace(api, event, ids);
    },
    onKey(event, api) {
      if (event.altKey) return false;
      const { draft, mode } = getTrace();
      if (event.key.toLowerCase() === 'l') {
        if (!event.repeat) {
          updateTrace({ mode: nextMode(mode), error: null });
          updateOverlay(api.snapshot().doc, cursor);
        }
        return true;
      }
      if (event.key !== 'Backspace' || !draft) return false;
      if (draft.waypoints.length === 0) {
        updateTrace({ draft: null, preview: null, error: null });
      } else {
        updateTrace({ draft: { ...draft, waypoints: draft.waypoints.slice(0, -1) }, error: null });
        updateOverlay(api.snapshot().doc, cursor);
      }
      return true;
    },
    overlay: () => createElement(TraceOverlay),
    onCancel() {
      down = undefined;
      cursor = undefined;
      resetTraceTool();
    },
  };
}

export function createTraceToolSpec(ids: IdGen): ToolSpec {
  return {
    id: TRACE_TOOL_ID,
    label: connectionsEt.traceTool,
    icon: 'trace',
    key: 'T',
    group: 'draw',
    create: () => createTraceTool(ids),
  };
}
