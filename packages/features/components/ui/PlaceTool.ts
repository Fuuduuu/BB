import type { IdGen } from '@pcbk/contracts';
import type { FootprintParams, Vec2 } from '@pcbk/domain';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import type { CanvasTool, Selection, ToolApi, ToolSpec } from '@pcbk/ui';
import { makePlacedComponent } from '../contract';
import type { LibraryEntry } from '../contract';
import { commandError } from './errors';
import { componentEt, placementEt } from './i18n/et';
import { placementRotation } from './placement-rotation';
import {
  currentPlacementPreview,
  PLACE_TOOL_ID,
  placementAngle,
  placementEntries,
  usePlaceStore,
} from './place-store';
import type { PlacementAnchor, PlacementRequest } from './place-store';

const DRAG_THRESHOLD = 3;

function isDrag(start: Vec2, current: Vec2): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= DRAG_THRESHOLD;
}

export function openPlacementAt(api: ToolApi, _selection: Selection, at: Vec2): boolean {
  usePlaceStore.setState({
    request: null,
    cursor: null,
    rotationOffsetDeg: 0,
    anchor: { center: { ...at }, rotationDeg: placementRotation(api.sceneTransform()) },
    error: null,
  });
  const view = useViewStore.getState();
  view.setNavigatorOpen(true);
  view.setNavigatorTab('library');
  return true;
}

export function addPlacedComponent(
  engine: Pick<ToolApi, 'execute'>,
  ids: IdGen,
  entry: LibraryEntry,
  params: FootprintParams,
  { center, rotationDeg }: PlacementAnchor,
): string | null {
  const component = makePlacedComponent(ids, entry, params, center);
  component.board = { ...component.board!, rotationDeg };
  const result = engine.execute('components.add', component);
  usePlaceStore.setState({ error: result.ok ? null : commandError(result.error) });
  return result.ok ? component.id : null;
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
      if (request?.params) gesture = { screen, request, dragged: false };
    },
    onPointerMove({ world: center, screen }, api) {
      if (gesture) gesture.dragged ||= isDrag(gesture.screen, screen);
      if (!usePlaceStore.getState().request) return;
      usePlaceStore.setState({
        cursor: { center, baseRotationDeg: placementRotation(api.sceneTransform()) },
      });
      api.setPreview(currentPlacementPreview());
    },
    onKey(event, api) {
      const { request, rotationOffsetDeg } = usePlaceStore.getState();
      if (
        !request ||
        event.key.toLowerCase() !== 'r' ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      )
        return false;
      if (!event.repeat) {
        usePlaceStore.setState({
          rotationOffsetDeg: (rotationOffsetDeg + (event.shiftKey ? 270 : 90)) % 360,
        });
        api.setPreview(currentPlacementPreview());
      }
      return true;
    },
    onPointerUp({ world: center, screen }, api) {
      const { request } = usePlaceStore.getState();
      const finished = gesture;
      gesture = undefined;
      if (
        !request?.params ||
        finished?.request !== request ||
        finished.dragged ||
        isDrag(finished.screen, screen)
      ) {
        return;
      }

      const baseRotationDeg = placementRotation(api.sceneTransform());
      const rotationDeg = placementAngle(baseRotationDeg);
      if (request.mode === 'new') {
        const entry = placementEntries.get(request.entryId);
        if (!entry) {
          usePlaceStore.setState({ error: componentEt.invalid });
          return;
        }
        const id = addPlacedComponent(api, ids, entry, request.params, { center, rotationDeg });
        if (id === null) return;
        api.select({ items: [{ kind: 'component', id }] });
        usePlaceStore.setState({ cursor: { center, baseRotationDeg } });
        api.setPreview(currentPlacementPreview());
        return;
      }

      const { componentId: id, footprint, params } = request;
      const result = api.execute('components.placeOnBoard', {
        id,
        board: { footprint, params, center, rotationDeg },
      });
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
