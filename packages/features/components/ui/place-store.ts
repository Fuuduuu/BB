import { create } from 'zustand';
import { useSessionStore } from '@pcbk/ui';
import type { FootprintParams, Vec2 } from '@pcbk/domain';

export const PLACE_TOOL_ID = 'components.place';

export type PlacementRequest =
  | { mode: 'new'; entryId: string; params: FootprintParams }
  | { mode: 'existing'; componentId: string; footprint: string; params: FootprintParams };

export type PlacementAnchor = { center: Vec2; rotationDeg: number };

interface PlaceStore {
  request: PlacementRequest | null;
  anchor: PlacementAnchor | null;
  error: string | null;
  reset(): void;
}

export const usePlaceStore = create<PlaceStore>((set) => ({
  request: null,
  anchor: null,
  error: null,
  reset: () => set({ request: null, anchor: null, error: null }),
}));

export function beginPlacement(request: PlacementRequest): void {
  usePlaceStore.setState({
    request: { ...request, params: { ...request.params } },
    anchor: null,
    error: null,
  });
  const session = useSessionStore.getState();
  session.setPreview(null);
  session.setToolId(PLACE_TOOL_ID);
}
