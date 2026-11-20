import { create } from 'zustand';
import { useSessionStore } from '@pcbk/ui';
import type { FootprintParams, Vec2 } from '@pcbk/domain';
import { COMPONENT_LIBRARY } from '../contract';

export const PLACE_TOOL_ID = 'components.place';
export const placementEntries = new Map(COMPONENT_LIBRARY.map((entry) => [entry.id, entry]));

export type PlacementRequest =
  | { mode: 'new'; entryId: string; params: FootprintParams | null }
  | { mode: 'existing'; componentId: string; footprint: string; params: FootprintParams };

export type PlacementAnchor = { center: Vec2; rotationDeg: number };
export type PlacePreviewData = PlacementAnchor & { footprint: string; params: FootprintParams };

interface PlaceStore {
  request: PlacementRequest | null;
  anchor: PlacementAnchor | null;
  cursor: { center: Vec2; baseRotationDeg: number } | null;
  rotationOffsetDeg: number;
  error: string | null;
  reset(): void;
}

const initialPlacement = {
  request: null,
  anchor: null,
  cursor: null,
  rotationOffsetDeg: 0,
  error: null,
};

export const usePlaceStore = create<PlaceStore>((set) => ({
  ...initialPlacement,
  reset: () => set(initialPlacement),
}));

export function beginPlacement(request: PlacementRequest): void {
  usePlaceStore.setState({
    ...initialPlacement,
    request: request.params === null ? request : { ...request, params: { ...request.params } },
  });
  const session = useSessionStore.getState();
  session.setPreview(null);
  session.setToolId(PLACE_TOOL_ID);
}

export function placementAngle(baseRotationDeg: number): number {
  return (baseRotationDeg + usePlaceStore.getState().rotationOffsetDeg) % 360;
}

export function currentPlacementPreview() {
  const { request, cursor } = usePlaceStore.getState();
  if (!cursor || !request?.params) return null;
  const entry = request.mode === 'new' ? placementEntries.get(request.entryId) : request;
  if (!entry) return null;
  const data: PlacePreviewData = {
    footprint: entry.footprint,
    params: { ...entry.params, ...request.params },
    center: cursor.center,
    rotationDeg: placementAngle(cursor.baseRotationDeg),
  };
  return { owner: PLACE_TOOL_ID, data };
}

export function updatePlacementParams(params: FootprintParams | null): void {
  const { request } = usePlaceStore.getState();
  const session = useSessionStore.getState();
  if (session.toolId !== PLACE_TOOL_ID || request?.mode !== 'new') return;
  usePlaceStore.setState({ request: { ...request, params: params && { ...params } } });
  session.setPreview(currentPlacementPreview());
}
