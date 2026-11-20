import type { EndRef, Layer, Vec2 } from '@pcbk/domain';
import { create } from 'zustand';
import type { Drawing, DrawingHit, EndpointHit } from './trace-geometry';

export const TRACE_TOOL_ID = 'connections.trace';

export type TraceMode = { kind: Drawing['kind']; layer: Layer };
export type TraceDraft = { start: EndRef; waypoints: Vec2[]; existingId?: string };
type TracePreview = {
  points: Vec2[];
  cursor?: Vec2;
  target?: { hit: EndpointHit | DrawingHit; accepted: boolean };
  pxPerMm: number;
  zoom: number;
};

interface TraceState {
  mode: TraceMode;
  draft: TraceDraft | null;
  preview: TracePreview | null;
  error: string | null;
}

const initial: TraceState = {
  mode: { kind: 'trace', layer: 'top' },
  draft: null,
  preview: null,
  error: null,
};

export const useTraceStore = create<TraceState>(() => initial);

export function resetTraceTool() {
  useTraceStore.setState(initial);
}
