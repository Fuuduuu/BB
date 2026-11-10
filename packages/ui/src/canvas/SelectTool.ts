import type { ParamsOf, Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { et } from '../shell/i18n/et';
import type { Selection, SelectionItem } from '../shell/session-store';
import type { HitItem } from './hit-index';
import type { CanvasPointer, CanvasTool, ToolSpec } from './tools';

export type TranslatePreviewData = { items: SelectionItem[]; dx: number; dy: number };

type Translation = ParamsOf<'items.translate'>;

interface Gesture {
  start: CanvasPointer;
  items: Translation['items'];
  dragged: boolean;
}

const SELECT_ID = 'select';
const DRAG_THRESHOLD = 3;
const nudgeDirections = new Map<string, Vec2>([
  ['ArrowLeft', { x: -1, y: 0 }],
  ['ArrowRight', { x: 1, y: 0 }],
  ['ArrowUp', { x: 0, y: -1 }],
  ['ArrowDown', { x: 0, y: 1 }],
]);

function selectedBoardComponents(selection: Selection, snapshot: Snapshot): Translation['items'] {
  const unplaced = snapshot.derived.unplacedBoard;
  return selection.items.flatMap(({ kind, id }) =>
    kind === 'component' && !unplaced.includes(id) ? [{ kind, id }] : [],
  );
}

function selectionForHit(hit: HitItem | undefined): Selection {
  if (!hit) return { items: [] };
  if (hit.target) return { items: [hit.target] };
  const { kind, id, componentId } = hit;
  return { items: [componentId === undefined ? { kind, id } : { kind, id, componentId }] };
}

function crossedDragThreshold(start: CanvasPointer, current: CanvasPointer): boolean {
  return (
    Math.hypot(current.screen.x - start.screen.x, current.screen.y - start.screen.y) >=
    DRAG_THRESHOLD
  );
}

function translationOffset(start: Vec2, world: Vec2) {
  return {
    dx: world.x - start.x,
    dy: world.y - start.y,
  };
}

function createSelectTool(getSelection: () => Selection): CanvasTool {
  let gesture: Gesture | undefined;

  return {
    id: SELECT_ID,
    cursor: 'default',
    onPointerDown(event, api) {
      const { hit } = event;
      const next: Gesture = { start: event, items: [], dragged: false };
      gesture = next;
      if (hit?.drag) return;
      if (hit?.kind === 'component' && !hit.target) {
        const current = getSelection();
        const alreadySelected = current.items.some(
          ({ kind, id }) => kind === 'component' && id === hit.id,
        );
        const selection = alreadySelected ? current : selectionForHit(hit);
        if (!alreadySelected) api.select(selection);
        next.items = selectedBoardComponents(selection, api.snapshot());
      } else if (hit?.kind === 'pin' && hit.componentId !== undefined) {
        next.items = selectedBoardComponents(
          { items: [{ kind: 'component', id: hit.componentId }] },
          api.snapshot(),
        );
      }
    },
    onPointerMove(event, api) {
      if (!gesture) return;
      gesture.dragged ||= crossedDragThreshold(gesture.start, event);
      if (!gesture.dragged) return;
      const { hit, world } = gesture.start;
      const offset = translationOffset(world, event.world);
      if (hit?.drag) {
        api.setPreview({ owner: hit.drag.owner, data: { id: hit.id, ...offset } });
      } else if (gesture.items.length > 0) {
        const data: TranslatePreviewData = { items: gesture.items, ...offset };
        api.setPreview({ owner: SELECT_ID, data });
      }
    },
    onPointerUp(event, api) {
      const finished = gesture;
      gesture = undefined;
      if (!finished) return;
      const { hit, world } = finished.start;
      if (!finished.dragged && !crossedDragThreshold(finished.start, event)) {
        if (hit?.kind !== 'component' || hit.drag || hit.target) api.select(selectionForHit(hit));
        return;
      }
      if (!hit?.drag && finished.items.length === 0) return;
      api.setPreview(null);
      const { dx, dy } = translationOffset(world, event.world);
      if (hit?.drag) hit.drag.commit({ x: dx, y: dy }, api);
      else api.execute('items.translate', { items: finished.items, dx, dy });
    },
    onKey(event, api) {
      const direction = nudgeDirections.get(event.key);
      if (!direction || event.altKey || event.ctrlKey || event.metaKey) return false;
      const items = selectedBoardComponents(getSelection(), api.snapshot());
      if (items.length === 0) return false;
      if (!event.repeat && !gesture) {
        const step = event.shiftKey ? 10 : 1;
        api.execute('items.translate', { items, dx: direction.x * step, dy: direction.y * step });
      }
      return true;
    },
    onCancel(api) {
      gesture = undefined;
      api.setPreview(null);
    },
  };
}

export function createSelectToolSpec(getSelection: () => Selection): ToolSpec {
  return {
    id: SELECT_ID,
    label: et.shell.selectTool,
    icon: SELECT_ID,
    key: 'V',
    group: 'select',
    create: () => createSelectTool(getSelection),
  };
}
