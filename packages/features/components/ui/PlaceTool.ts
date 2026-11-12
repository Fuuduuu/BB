import type { IdGen } from '@pcbk/contracts';
import type { FootprintParams, Vec2 } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import type { CanvasTool, ToolApi, ToolSpec } from '@pcbk/ui';
import { COMPONENT_LIBRARY, makePlacedComponent } from '../contract';
import { commandError } from './errors';
import { componentEt, placementEt } from './i18n/et';
import { placementRotation } from './placement-rotation';
import { PLACE_TOOL_ID, usePlaceStore } from './place-store';
import type { PlacementRequest } from './place-store';

export type PlacePreviewData = { footprint: string; params: FootprintParams; center: Vec2 };

const entries = new Map(COMPONENT_LIBRARY.map((entry) => [entry.id, entry]));
const DRAG_THRESHOLD = 3;

function isDrag(start: Vec2, current: Vec2): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= DRAG_THRESHOLD;
}

function createPlaceTool(ids: IdGen): CanvasTool {
  let gesture: { screen: Vec2; request: PlacementRequest; dragged: boolean } | undefined;

  function endPlacement(api: ToolApi): void {
    gesture = undefined;
    usePlaceStore.getState().reset();
    api.setPreview(null);
    const session = useSessionStore.getState();
    if (session.toolId === PLACE_TOOL_ID) session.setToolId('select');
  }

  return {
    id: PLACE_TOOL_ID,
    cursor: 'crosshair',
    onPointerDown({ screen }) {
      const { request } = usePlaceStore.getState();
      if (request) gesture = { screen, request, dragged: false };
    },
    onPointerMove({ world: center, screen }, api) {
      if (gesture) gesture.dragged ||= isDrag(gesture.screen, screen);
      const { request } = usePlaceStore.getState();
      if (!request) return;

      let data: PlacePreviewData;
      if (request.mode === 'new') {
        const entry = entries.get(request.entryId);
        if (!entry) return;
        data = {
          footprint: entry.footprint,
          params: { ...entry.params, ...request.params },
          center,
        };
      } else {
        data = { footprint: request.footprint, params: request.params, center };
      }
      api.setPreview({ owner: PLACE_TOOL_ID, data });
    },
    onPointerUp({ world: center, screen }, api) {
      const { request } = usePlaceStore.getState();
      const finished = gesture;
      gesture = undefined;
      if (
        !request ||
        finished?.request !== request ||
        finished.dragged ||
        isDrag(finished.screen, screen)
      ) {
        return;
      }

      const rotationDeg = placementRotation(api.sceneTransform());
      let id: string;
      let result: ReturnType<ToolApi['execute']>;
      if (request.mode === 'new') {
        const entry = entries.get(request.entryId);
        if (!entry) {
          usePlaceStore.setState({ error: componentEt.invalid });
          return;
        }
        const params = makePlacedComponent(ids, entry, request.params, center);
        params.board = { ...params.board!, rotationDeg };
        id = params.id;
        result = api.execute('components.add', params);
      } else {
        id = request.componentId;
        const { footprint, params } = request;
        result = api.execute('components.placeOnBoard', {
          id,
          board: { footprint, params, center, rotationDeg },
        });
      }
      if (!result.ok) {
        usePlaceStore.setState({ error: commandError(result.error) });
        return;
      }
      api.select({ items: [{ kind: 'component', id }] });
      endPlacement(api);
    },
    onCancel: endPlacement,
  };
}

export function createPlaceToolSpec(ids: IdGen): ToolSpec {
  return {
    id: PLACE_TOOL_ID,
    label: placementEt.tool,
    icon: 'place',
    group: 'draw',
    create: () => createPlaceTool(ids),
  };
}
