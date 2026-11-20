import type { IdGen, Snapshot } from '@pcbk/contracts';
import type { EndRef, Vec2 } from '@pcbk/domain';
import { branchConnection, endAcceptsDrawing, endKey, RuleRejected } from '@pcbk/domain/rules';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import type { CanvasPointer, CanvasTool, HitIndex, HitMatch, ToolApi, ToolSpec } from '@pcbk/ui';
import { createElement } from 'react';
import { TRACE_WIDTH_MM, WIRE_WIDTH_MM } from '../contract';
import { connectionEndpoint } from './connection-geometry';
import { connectionsEt } from './i18n/et';
import { distance, drawingHits, endpointHit, snappedWaypoint } from './trace-geometry';
import type { Drawing, DrawingHit, EndpointHit } from './trace-geometry';
import { resetTraceTool, TRACE_TOOL_ID, useTraceStore } from './trace-store';
import type { TraceDraft, TraceMode } from './trace-store';
import { TraceOverlay } from './TraceOverlay';

export { resetTraceTool } from './trace-store';

type Doc = Snapshot['doc'];
type EndTarget = { kind: 'end'; hit: EndpointHit; at: Vec2; accepted: boolean };
type BranchTarget = { kind: 'branch'; hit: DrawingHit; at: Vec2; accepted: boolean };
type Target = EndTarget | BranchTarget;

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
  if (mode.kind === 'wire' || accepts(doc, start, mode)) return mode;
  const layer =
    'pin' in start
      ? doc.components.find(({ id }) => id === start.pin.c)?.board?.side
      : doc.junctions.find(({ id }) => id === start.junction)?.board?.layer;
  return layer ? { kind: 'trace', layer } : mode;
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

export function startTraceFrom(api: ToolApi, end: EndRef): boolean {
  const { doc } = api.snapshot();
  if (!connectionEndpoint(doc, end)) return false;
  begin(doc, end);
  useSessionStore.getState().setToolId(TRACE_TOOL_ID);
  return true;
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
  matches: HitMatch[],
  world: Vec2,
  draft: TraceDraft,
  mode: TraceMode,
): Target | undefined {
  const existing = draft.existingId ? savedConnection(doc, draft.existingId) : undefined;
  if (draft.existingId && !existing) return;
  const startKey = endKey(draft.start);
  const existingEndKey = existing && endKey(existing.b);
  let firstEnd: EndTarget | undefined;
  let exactEnd: EndTarget | undefined;
  for (const { item, exact } of matches) {
    const hit = endpointHit(doc, item);
    if (!hit) continue;
    const key = endKey(hit.end);
    if (key === startKey || (existingEndKey !== undefined && key !== existingEndKey)) continue;
    const at = connectionEndpoint(doc, hit.end);
    if (!at) continue;
    const end: EndTarget = {
      kind: 'end',
      hit,
      at,
      accepted: accepts(doc, draft.start, mode) && accepts(doc, hit.end, mode),
    };
    firstEnd ??= end;
    if (exact) {
      exactEnd = end;
      break;
    }
  }
  if (existing || (exactEnd && exactEnd === firstEnd)) return firstEnd;

  const drawings = drawingHits(doc, matches, world);
  if (!drawings.length) return firstEnd;
  if (exactEnd) return exactEnd;

  let nearestDenied: BranchTarget | undefined;
  for (const hit of drawings) {
    const target: BranchTarget = {
      kind: 'branch',
      hit,
      at: hit.at,
      accepted: acceptsBranch(doc, hit, draft, mode),
    };
    if (target.accepted) return target;
    nearestDenied ??= target;
  }
  return nearestDenied;
}

function cursorPoint(event: CanvasPointer, from: Vec2, target: Target | undefined): Vec2 {
  if (target) return target.accepted ? target.at : event.world;
  return event.shift ? snappedWaypoint(from, event.world) : event.world;
}

function updateOverlay(doc: Doc, hitIndex: HitIndex, event?: CanvasPointer) {
  const { draft, mode } = getTrace();
  const start = draft && connectionEndpoint(doc, draft.start);
  if (!draft || !start) {
    updateTrace({ preview: null });
    return;
  }
  const zoom = zoomNow();
  const target =
    event && findTarget(doc, hitIndex.queryAll(event.world, zoom), event.world, draft, mode);
  const points = [start, ...draft.waypoints];
  const cursor = event && cursorPoint(event, points.at(-1)!, target);
  updateTrace({
    preview: {
      points,
      cursor,
      pxPerMm: doc.scale.pxPerMm,
      zoom,
      ...(target && (target.accepted || target.kind === 'branch') ? { target } : {}),
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
  const zoom = zoomNow();
  const matches = api.hitIndex.queryAll(event.world, zoom);
  if (!draft) {
    const hit = endpointHit(doc, matches[0]?.item);
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

  const target = findTarget(doc, matches, event.world, draft, mode);
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
    updateOverlay(doc, api.hitIndex);
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
      if (getTrace().draft) updateOverlay(api.snapshot().doc, api.hitIndex, event);
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
          updateOverlay(api.snapshot().doc, api.hitIndex, cursor);
        }
        return true;
      }
      if (event.key !== 'Backspace' || !draft) return false;
      if (draft.waypoints.length === 0) {
        updateTrace({ draft: null, preview: null, error: null });
      } else {
        updateTrace({ draft: { ...draft, waypoints: draft.waypoints.slice(0, -1) }, error: null });
        updateOverlay(api.snapshot().doc, api.hitIndex, cursor);
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
