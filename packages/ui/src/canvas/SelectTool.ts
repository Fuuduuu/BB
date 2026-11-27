import type { Vec2 } from '@pcbk/domain';
import { SCHEMATIC_GRID_MM } from '@pcbk/domain/schematic';
import { et } from '../shell/i18n/et';
import { matchesShellKey, SHELL_KEYS } from '../shell/keymap';
import type { Selection, SelectionItem } from '../shell/session-store';
import type { MoveRef, SelectionFrame, UiRegistry } from '../shell/UiRegistry';
import type { HitItem } from './hit-index';
import { screenToSceneVector } from './stage';
import type { CanvasPointer, CanvasTool, ToolSpec } from './tools';

export type TranslatePreviewData = { items: MoveRef[]; dx: number; dy: number };

interface Gesture {
  start: CanvasPointer;
  items: MoveRef[];
  selectionHandled: boolean;
  dragged: boolean;
}

const SELECT_ID = 'select';
export const SELECT_FRAME_OWNER = 'select.frame';
const DRAG_THRESHOLD = 3;
const noItemsInFrame: UiRegistry['itemsInFrame'] = () => [];
const noDeleteIds: UiRegistry['deleteIds'] = () => [];
const nudgeDirections = new Map<string, Vec2>([
  [SHELL_KEYS.nudgeLeft.key, { x: -1, y: 0 }],
  [SHELL_KEYS.nudgeRight.key, { x: 1, y: 0 }],
  [SHELL_KEYS.nudgeUp.key, { x: 0, y: -1 }],
  [SHELL_KEYS.nudgeDown.key, { x: 0, y: 1 }],
]);

export function selectionForHit(hit: HitItem | undefined): Selection {
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

function sameItem(a: SelectionItem, b: SelectionItem): boolean {
  return a.kind === b.kind && a.id === b.id && a.componentId === b.componentId;
}

function toggleItem(selection: Selection, item: SelectionItem): Selection {
  const { items } = selection;
  return {
    items: items.some((selected) => sameItem(selected, item))
      ? items.filter((selected) => !sameItem(selected, item))
      : [...items, item],
  };
}

function appendItems(selection: Selection, additions: SelectionItem[]): Selection {
  const items = [...selection.items];
  const key = ({ kind, id, componentId }: SelectionItem) => JSON.stringify([kind, id, componentId]);
  const added = new Set(items.map(key));
  for (const item of additions) {
    const id = key(item);
    if (added.has(id)) continue;
    items.push(item);
    added.add(id);
  }
  return { items };
}

function selectionFrame(start: Vec2, end: Vec2): SelectionFrame {
  return {
    min: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
    max: { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) },
  };
}

function createSelectTool(
  getSelection: () => Selection,
  moveRefs: UiRegistry['moveRefs'],
  itemsInFrame: UiRegistry['itemsInFrame'],
  deleteIds: UiRegistry['deleteIds'],
  space: 'board' | 'schematic',
): CanvasTool {
  let gesture: Gesture | undefined;
  const view = space === 'schematic' ? { view: space } : {};
  const unit = space === 'schematic' ? SCHEMATIC_GRID_MM : 1;

  return {
    id: SELECT_ID,
    cursor: 'default',
    onPointerDown(event, api) {
      const { hit } = event;
      const next: Gesture = { start: event, items: [], selectionHandled: false, dragged: false };
      gesture = next;
      if (event.shift || !hit || hit.drag) return;
      const snapshot = api.snapshot();
      if (!hit.target && moveRefs(snapshot, [hit]).length > 0) {
        const current = getSelection();
        const alreadySelected = current.items.some((item) => sameItem(item, hit));
        const selection = alreadySelected ? current : selectionForHit(hit);
        if (!alreadySelected) api.select(selection);
        next.items = moveRefs(snapshot, selection.items);
        next.selectionHandled = true;
      } else if (hit.moves) {
        next.items = moveRefs(snapshot, [hit.moves]);
      }
    },
    onPointerMove(event, api) {
      if (!gesture) return;
      gesture.dragged ||= crossedDragThreshold(gesture.start, event);
      if (!gesture.dragged) return;
      const { hit, shift, world } = gesture.start;
      if (shift || !hit) {
        api.setPreview({ owner: SELECT_FRAME_OWNER, data: selectionFrame(world, event.world) });
        return;
      }
      const offset = translationOffset(world, event.world);
      if (hit.drag) {
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
      const { hit, shift, world } = finished.start;
      const pastThreshold = crossedDragThreshold(finished.start, event);
      if (!finished.dragged && !pastThreshold) {
        const clicked = selectionForHit(hit);
        if (shift) {
          const item = clicked.items[0];
          if (item) api.select(toggleItem(getSelection(), item));
        } else if (!finished.selectionHandled) {
          api.select(clicked);
        }
        return;
      }
      if (shift || !hit) {
        api.setPreview(null);
        if (pastThreshold) {
          const items = itemsInFrame(api.snapshot(), selectionFrame(world, event.world));
          api.select(shift ? appendItems(getSelection(), items) : { items });
        }
        return;
      }
      if (!hit.drag && finished.items.length === 0) return;
      api.setPreview(null);
      const { dx, dy } = translationOffset(world, event.world);
      if (hit.drag) hit.drag.commit({ x: dx, y: dy }, api);
      else api.execute('items.translate', { items: finished.items, dx, dy, ...view });
    },
    onKey(event, api) {
      if (matchesShellKey(event, SHELL_KEYS.delete)) {
        if (event.repeat) return false;
        const ids = deleteIds(api.snapshot(), getSelection().items);
        if (ids.length === 0) return false;
        api.execute('items.delete', { ids });
        return true;
      }
      const direction = nudgeDirections.get(event.key);
      if (!direction || event.altKey || event.ctrlKey || event.metaKey) return false;
      const items = moveRefs(api.snapshot(), getSelection().items);
      if (items.length === 0) return false;
      if (!event.repeat && !gesture) {
        const step = unit * (event.shiftKey ? 10 : 1);
        const world = screenToSceneVector(api.sceneTransform(), direction);
        api.execute('items.translate', { items, dx: world.x * step, dy: world.y * step, ...view });
      }
      return true;
    },
    onCancel(api) {
      gesture = undefined;
      api.setPreview(null);
    },
  };
}

export function createSelectToolSpec(
  getSelection: () => Selection,
  moveRefs: UiRegistry['moveRefs'],
  itemsInFrame = noItemsInFrame,
  deleteIds = noDeleteIds,
  space: 'board' | 'schematic' = 'board',
): ToolSpec {
  return {
    id: SELECT_ID,
    label: et.shell.selectTool,
    icon: SELECT_ID,
    key: SHELL_KEYS.select.key,
    group: 'select',
    create: () => createSelectTool(getSelection, moveRefs, itemsInFrame, deleteIds, space),
  };
}
