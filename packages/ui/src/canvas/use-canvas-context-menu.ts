import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, MutableRefObject, RefObject } from 'react';
import type { Vec2 } from '@pcbk/domain';
import { useSessionStore } from '../shell/session-store';
import type { Selection } from '../shell/session-store';
import type { ContextMenuItemSpec } from '../shell/UiRegistry';
import { selectionForHit } from './SelectTool';
import { pointerWorld } from './stage';
import type { ToolApi } from './tools';

export type CanvasInsets = { left?: number; right?: number; top?: number; bottom?: number };

export function visibleCanvasBounds(
  bounds: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>,
  { left = 0, right = 0, top = 0, bottom = 0 }: CanvasInsets = {},
) {
  return {
    left: bounds.left + left,
    top: bounds.top + top,
    width: Math.max(0, bounds.width - left - right),
    height: Math.max(0, bounds.height - top - bottom),
  };
}

interface CanvasContextMenu {
  api: ToolApi;
  contextMenu?: (kind: string) => ContextMenuItemSpec[];
  fitInsets?: CanvasInsets;
  isGesturing(): boolean;
  viewRef: MutableRefObject<{ zoom: number }>;
  scene: RefObject<SVGGElement>;
  sessionId: string;
  svg: RefObject<SVGSVGElement>;
  toolId: string;
  viewport: RefObject<HTMLDivElement>;
}

interface OpenMenu {
  at: Vec2;
  screen: Vec2;
  items: ContextMenuItemSpec[];
  selection: Selection;
}

function screenPoint(event: Pick<MouseEvent, 'clientX' | 'clientY'>): Vec2 {
  return { x: event.clientX, y: event.clientY };
}

function menuSelection(kind: string, selection: Selection): Selection {
  if (kind !== 'pin') return selection;
  const pin = selection.items.find((item) => item.kind === 'pin');
  return { items: pin ? [pin] : [] };
}

function availableItems(
  items: ContextMenuItemSpec[],
  snapshot: ReturnType<ToolApi['snapshot']>,
  selection: Selection,
): ContextMenuItemSpec[] {
  return items.filter((item) => item.available?.(snapshot, selection) !== false);
}

export function useCanvasContextMenu({
  api,
  contextMenu,
  fitInsets,
  isGesturing,
  viewRef,
  scene,
  sessionId,
  svg,
  toolId,
  viewport,
}: CanvasContextMenu) {
  const [open, setOpen] = useState<OpenMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastScreen = useRef<Vec2 | null>(null);
  const keyboardOpening = useRef(false);
  const close = useCallback(() => {
    if (menuRef.current) svg.current?.focus({ preventScroll: true });
    setOpen(null);
  }, [svg]);

  useLayoutEffect(() => {
    lastScreen.current = null;
    keyboardOpening.current = false;
    close();
  }, [close, sessionId]);

  useLayoutEffect(() => {
    if (toolId !== 'select') close();
  }, [close, toolId]);

  useLayoutEffect(() => {
    function onPointerDown(event: PointerEvent) {
      keyboardOpening.current = false;
      if (
        !menuRef.current ||
        !(event.target instanceof Node) ||
        menuRef.current.contains(event.target)
      )
        return;
      if (event.button !== 2 && viewport.current?.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      close();
    }
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [close, viewport]);

  const openFromKeyboard = useCallback(() => {
    if (!contextMenu || isGesturing() || !scene.current || !viewport.current) return;
    const { selection: currentSelection, toolId: currentTool } = useSessionStore.getState();
    if (currentTool !== 'select') return;
    const kind = currentSelection.items[0]?.kind ?? 'empty';
    const selection = menuSelection(kind, currentSelection);
    const items = availableItems(contextMenu(kind), api.snapshot(), selection);
    keyboardOpening.current = true;
    if (items.length === 0) return;
    const bounds = visibleCanvasBounds(viewport.current.getBoundingClientRect(), fitInsets);
    const screen = lastScreen.current ?? {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
    setOpen({
      at: pointerWorld(scene.current, screen),
      screen,
      items,
      selection,
    });
  }, [api, contextMenu, fitInsets, isGesturing, scene, viewport]);

  function onContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    if (keyboardOpening.current) {
      keyboardOpening.current = false;
      return;
    }
    if (
      !contextMenu ||
      isGesturing() ||
      !scene.current ||
      menuRef.current?.contains(event.target as Node)
    )
      return;
    const session = useSessionStore.getState();
    if (session.toolId !== 'select') return;
    const screen = screenPoint(event);
    lastScreen.current = screen;
    const at = pointerWorld(scene.current, screen);
    const hit = api.hitIndex.query(at, viewRef.current.zoom);
    const hitSelection = selectionForHit(hit);
    const target = hitSelection.items[0];
    const currentSelection =
      target &&
      !session.selection.items.some(
        ({ kind, id, componentId }) =>
          kind === target.kind && id === target.id && componentId === target.componentId,
      )
        ? hitSelection
        : session.selection;
    if (currentSelection !== session.selection) api.select(currentSelection);
    const kind = target?.kind ?? 'empty';
    const selection = menuSelection(kind, currentSelection);
    const items = availableItems(contextMenu(kind), api.snapshot(), selection);
    if (items.length > 0) setOpen({ at, screen, items, selection });
    else close();
  }

  function activate(item: ContextMenuItemSpec) {
    if (!open) return;
    close();
    item.run(api, open.selection, open.at);
  }

  function trackPointer(event: Pick<MouseEvent, 'clientX' | 'clientY'>) {
    lastScreen.current = screenPoint(event);
  }

  return { open, close, menuRef, activate, onContextMenu, openFromKeyboard, trackPointer };
}
