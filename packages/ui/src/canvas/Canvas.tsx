import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { DocumentEngine, Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { et } from '../shell/i18n/et';
import { useSessionStore } from '../shell/session-store';
import type { Preview } from '../shell/session-store';
import type { ContextMenuItemSpec, KeySpec, UiRegistry } from '../shell/UiRegistry';
import { CanvasHud } from './CanvasHud';
import { ContextMenu } from './ContextMenu';
import { createHitIndex } from './hit-index';
import { LabelObstaclesContext } from './label-obstacles';
import { useCanvasContextMenu } from './use-canvas-context-menu';
import { useCanvasControls } from './use-canvas-controls';
import { useCanvasKeys } from './use-canvas-keys';
import { GESTURE_OVERSCAN, useCanvasView } from './use-canvas-view';
import { createPanToolSpec } from './PanTool';
import { createSelectToolSpec } from './SelectTool';
import { SelectionFrameLayer } from './SelectionFrameLayer';
import { SceneTransformContext } from './scene-text';
import { pointerWorld, sceneMatrix, screenToScenePoint, zoomAt } from './stage';
import type { SceneTransform } from './stage';
import type { CanvasPointer, CanvasTool, LayerSpec, ToolApi, ToolSpec } from './tools';

type CanvasView = { zoom: number; pan: Vec2 };

export interface CanvasProps {
  layers: readonly LayerSpec[];
  tools: readonly ToolSpec[];
  keys?: readonly KeySpec[];
  contextMenu?: (kind: string) => ContextMenuItemSpec[];
  moveRefs?: UiRegistry['moveRefs'];
  itemsInFrame?: UiRegistry['itemsInFrame'];
  deleteIds?: UiRegistry['deleteIds'];
  sceneTransform: SceneTransform;
  view: CanvasView;
  onViewChange(view: CanvasView): void;
  snapshot: Snapshot;
  execute: DocumentEngine['execute'];
  surface?: { width: number; height: number };
  fitInsets?: { left?: number; right?: number; top?: number; bottom?: number };
}

const LayerView = memo(
  ({ layer, snapshot, preview, zoom }: Parameters<LayerSpec['render']>[0] & { layer: LayerSpec }) =>
    layer.render({ snapshot, preview, zoom }),
);

const Layers = memo(
  ({
    layers,
    snapshot,
    preview,
    lodZoom,
  }: {
    layers: readonly LayerSpec[];
    snapshot: Snapshot;
    preview: Preview | null;
    lodZoom: number;
  }) =>
    layers.map((layer) => (
      <LayerView
        key={layer.id}
        layer={layer}
        snapshot={snapshot}
        preview={preview && layer.previewOwners?.includes(preview.owner) ? preview : null}
        zoom={lodZoom}
      />
    )),
);

const getSession = useSessionStore.getState;
const emptyMoveRefs: UiRegistry['moveRefs'] = () => [];

export function Canvas({
  layers,
  tools,
  keys,
  contextMenu,
  moveRefs = emptyMoveRefs,
  itemsInFrame,
  deleteIds,
  sceneTransform,
  view,
  onViewChange,
  snapshot,
  execute,
  surface,
  fitInsets,
}: CanvasProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const viewGroup = useRef<SVGGElement>(null);
  const scene = useRef<SVGGElement>(null);
  const gesture = useRef<{ pointerId: number; tool: CanvasTool } | null>(null);
  const isGesturing = useCallback(() => gesture.current !== null, []);
  const { viewRef, lodZoom, applyView, configureBuffer, pauseLod } = useCanvasView(
    view,
    svg,
    viewGroup,
    isGesturing,
  );
  const current = useRef({ snapshot, execute, onViewChange });
  // Snapshot identity may change for selection/preview; geometry changes with its revision/session.
  const layerData = useMemo(
    () => ({
      index: createHitIndex(
        layers.flatMap((layer) => layer.hits?.(snapshot, lodZoom, sceneTransform) ?? []),
      ),
      obstacles: layers.flatMap(
        (layer) => layer.obstacles?.(snapshot, lodZoom, sceneTransform) ?? [],
      ),
    }),
    [layers, snapshot.rev, snapshot.sessionId, lodZoom, sceneTransform],
  );
  const cache = useRef(layerData);
  const space = useRef(false);
  const preview = useSessionStore((store) => store.preview);
  const toolId = useSessionStore((store) => store.toolId);

  const changeView = useCallback(
    (next: CanvasView) => {
      const before = viewRef.current;
      if (!Number.isFinite(next.pan.x) || !Number.isFinite(next.pan.y)) return;
      if (before.zoom === next.zoom && before.pan.x === next.pan.x && before.pan.y === next.pan.y)
        return;
      applyView(next);
      current.current.onViewChange(next);
    },
    [applyView],
  );
  const geometry = useCanvasControls({
    viewport,
    svg,
    scene,
    viewRef,
    changeView,
    surface,
    fitInsets,
    sceneTransform,
    sessionId: snapshot.sessionId,
    isGesturing,
    onResize: configureBuffer,
  });
  const panByScreen = useCallback(
    (delta: Vec2) => {
      const bounds = geometry.current;
      if (!bounds) return;
      const { zoom, pan } = viewRef.current;
      changeView({
        zoom,
        pan: { x: pan.x + delta.x * bounds.scaleX, y: pan.y + delta.y * bounds.scaleY },
      });
    },
    [changeView, geometry, viewRef],
  );
  const toolset = useMemo(() => {
    const select = createSelectToolSpec(
      () => getSession().selection,
      moveRefs,
      itemsInFrame,
      deleteIds,
    );
    const pan = createPanToolSpec(panByScreen);
    return {
      select: select.create(),
      pan: pan.create(),
      custom: new Map(tools.map((spec) => [spec.id, spec.create()])),
      specs: [select, pan, ...tools],
    };
  }, [deleteIds, itemsInFrame, moveRefs, panByScreen, tools]);
  const active = toolId === 'pan' ? toolset.pan : (toolset.custom.get(toolId) ?? toolset.select);
  const emptyHits = useMemo(() => createHitIndex([]), []);
  const api = useMemo<ToolApi>(
    () => ({
      execute: (...args) => current.current.execute(...args),
      select: (selection) => getSession().setSelection(selection),
      setPreview: (next) => getSession().setPreview(next),
      get hitIndex() {
        return cache.current?.index ?? emptyHits;
      },
      snapshot: () => current.current.snapshot,
      sceneTransform: () => sceneTransform,
    }),
    [emptyHits, sceneTransform],
  );

  const cancel = useCallback(
    (tool: CanvasTool, gestureOnly = false) => {
      const down = gesture.current;
      gesture.current = null;
      // A temporary pan can own the pointer without owning the active tool's draft.
      const resetTool = !gestureOnly || down?.tool === tool;
      try {
        if (down && down.tool !== tool) down.tool.onCancel?.(api);
        if (resetTool) tool.onCancel?.(api);
      } finally {
        if (resetTool && getSession().preview !== null) api.setPreview(null);
        if (down && svg.current?.hasPointerCapture(down.pointerId)) {
          svg.current.releasePointerCapture(down.pointerId);
        }
      }
    },
    [api],
  );
  const cancelGesture = useCallback(() => {
    if (isGesturing()) cancel(active, true);
  }, [active, cancel, isGesturing]);

  useLayoutEffect(() => {
    const previousSnapshot = current.current.snapshot;
    current.current = { snapshot, execute, onViewChange };
    if (gesture.current && previousSnapshot.rev !== snapshot.rev) cancel(active);
    cache.current = layerData;
  }, [active, cancel, snapshot, execute, onViewChange, layerData]);
  useLayoutEffect(() => applyView(view), [applyView, view]);
  useLayoutEffect(
    () => () => {
      space.current = false;
      cancel(active);
    },
    [active, cancel, snapshot.sessionId, toolId],
  );

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (!element || gesture.current || !Number.isFinite(event.deltaY)) return;
      const before = viewRef.current;
      const bounds = geometry.current;
      if (!bounds) return;
      const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
      const zoom = Math.max(
        Math.min(0.05, before.zoom),
        Math.min(Math.max(32, before.zoom), before.zoom * Math.exp(-event.deltaY * step * 0.002)),
      );
      const at = {
        x: (event.clientX - bounds.left) * bounds.scaleX,
        y: (event.clientY - bounds.top) * bounds.scaleY,
      };
      changeView(zoomAt(before, at, zoom));
    }
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [changeView, geometry, viewRef]);

  const menu = useCanvasContextMenu({
    api,
    contextMenu,
    fitInsets,
    isGesturing,
    viewRef,
    scene,
    sessionId: snapshot.sessionId,
    svg,
    toolId,
    viewport,
  });
  useCanvasKeys({
    active,
    api,
    cancel,
    cancelGesture,
    keys,
    openContextMenu: menu.openFromKeyboard,
    space,
    specs: toolset.specs,
  });

  function pointer(event: PointerEvent<HTMLDivElement>, panning: boolean): CanvasPointer {
    const screen = { x: event.clientX, y: event.clientY };
    const bounds = geometry.current;
    const view = viewRef.current;
    const world = panning
      ? screenToScenePoint(
          sceneTransform,
          {
            x: ((screen.x - (bounds?.left ?? 0)) * (bounds?.scaleX ?? 1) - view.pan.x) / view.zoom,
            y: ((screen.y - (bounds?.top ?? 0)) * (bounds?.scaleY ?? 1) - view.pan.y) / view.zoom,
          },
          surface,
        )
      : pointerWorld(scene.current!, screen);
    return {
      screen,
      world,
      hit: panning ? undefined : api.hitIndex.query(world, view.zoom),
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey,
    };
  }

  return (
    <div
      ref={viewport}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        cursor: active.cursor,
      }}
      onContextMenu={menu.onContextMenu}
      onPointerDown={(event) => {
        if (gesture.current || (event.button !== 0 && event.button !== 1)) return;
        const tool = event.button === 1 || space.current ? toolset.pan : active;
        const at = pointer(event, tool === toolset.pan);
        event.preventDefault();
        svg.current?.focus({ preventScroll: true });
        svg.current?.setPointerCapture(event.pointerId);
        gesture.current = { pointerId: event.pointerId, tool };
        pauseLod();
        tool.onPointerDown(at, api);
      }}
      onPointerMove={(event) => {
        menu.trackPointer(event);
        const down = gesture.current;
        if (down && down.pointerId !== event.pointerId) return;
        const tool = down?.tool ?? active;
        tool.onPointerMove(pointer(event, tool === toolset.pan), api);
      }}
      onPointerUp={(event) => {
        const down = gesture.current;
        if (!down || down.pointerId !== event.pointerId) return;
        gesture.current = null;
        try {
          down.tool.onPointerUp(pointer(event, down.tool === toolset.pan), api);
        } finally {
          if (svg.current?.hasPointerCapture(event.pointerId)) {
            svg.current.releasePointerCapture(event.pointerId);
          }
        }
      }}
      onPointerCancel={(event) => {
        if (gesture.current?.pointerId === event.pointerId) cancel(active);
      }}
      onLostPointerCapture={(event) => {
        if (gesture.current?.pointerId === event.pointerId) cancel(active);
      }}
    >
      <svg
        ref={svg}
        tabIndex={0}
        aria-label={et.shell.canvas}
        style={{
          display: 'block',
          position: 'absolute',
          left: `${-GESTURE_OVERSCAN * 100}%`,
          top: `${-GESTURE_OVERSCAN * 100}%`,
          width: `${(1 + 2 * GESTURE_OVERSCAN) * 100}%`,
          height: `${(1 + 2 * GESTURE_OVERSCAN) * 100}%`,
          transformOrigin: '0 0',
          overflow: 'hidden',
        }}
      >
        <g ref={viewGroup} data-view="">
          <g ref={scene} data-scene="" transform={sceneMatrix(sceneTransform, surface)}>
            {surface && (
              <rect
                width={surface.width}
                height={surface.height}
                fill="var(--panel)"
                stroke="var(--line)"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            <SceneTransformContext.Provider value={sceneTransform}>
              <LabelObstaclesContext.Provider value={layerData.obstacles}>
                <Layers layers={layers} snapshot={snapshot} preview={preview} lodZoom={lodZoom} />
                <SelectionFrameLayer preview={preview} />
                {active.overlay?.(api)}
              </LabelObstaclesContext.Provider>
            </SceneTransformContext.Provider>
          </g>
        </g>
      </svg>
      {active.hud && (
        <CanvasHud value={{ viewport, scene, fitInsets }}>{active.hud(api, snapshot)}</CanvasHud>
      )}
      {menu.open && (
        <ContextMenu
          menuRef={menu.menuRef}
          viewport={viewport}
          fitInsets={fitInsets}
          screen={menu.open.screen}
          items={menu.open.items}
          selection={menu.open.selection}
          snapshot={snapshot}
          close={menu.close}
          activate={menu.activate}
        />
      )}
    </div>
  );
}
