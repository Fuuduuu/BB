import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { DocumentEngine, Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { et } from '../shell/i18n/et';
import { isEditing, matchesShellKey, SHELL_KEYS } from '../shell/keymap';
import { useSessionStore } from '../shell/session-store';
import type { Preview } from '../shell/session-store';
import type { KeySpec } from '../shell/UiRegistry';
import { createHitIndex } from './hit-index';
import { LabelObstaclesContext } from './label-obstacles';
import { useCanvasControls } from './use-canvas-controls';
import { GESTURE_OVERSCAN, useCanvasView } from './use-canvas-view';
import { createPanToolSpec } from './PanTool';
import { createSelectToolSpec } from './SelectTool';
import { SceneTransformContext } from './scene-text';
import { pointerWorld, sceneMatrix, screenToScenePoint, zoomAt } from './stage';
import type { SceneTransform } from './stage';
import type { CanvasPointer, CanvasTool, LayerSpec, ToolApi, ToolSpec } from './tools';

type CanvasView = { zoom: number; pan: Vec2 };

export interface CanvasProps {
  layers: readonly LayerSpec[];
  tools: readonly ToolSpec[];
  keys?: readonly KeySpec[];
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

export function Canvas({
  layers,
  tools,
  keys,
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
  const { viewRef, lodZoom, applyView, configureBuffer } = useCanvasView(view, svg, viewGroup);
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
  const gesture = useRef<{ pointerId: number; tool: CanvasTool } | null>(null);
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
    isGesturing: () => gesture.current !== null,
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
    const select = createSelectToolSpec(() => getSession().selection);
    const pan = createPanToolSpec(panByScreen);
    return {
      select: select.create(),
      pan: pan.create(),
      custom: new Map(tools.map((spec) => [spec.id, spec.create()])),
      specs: [select, pan, ...tools],
    };
  }, [panByScreen, tools]);
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
    (tool: CanvasTool) => {
      const down = gesture.current;
      gesture.current = null;
      try {
        if (down && down.tool !== tool) down.tool.onCancel?.(api);
        tool.onCancel?.(api);
      } finally {
        if (getSession().preview !== null) api.setPreview(null);
        if (down && svg.current?.hasPointerCapture(down.pointerId)) {
          svg.current.releasePointerCapture(down.pointerId);
        }
      }
    },
    [api],
  );

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

  useLayoutEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        isEditing(event)
      )
        return;
      if (matchesShellKey(event, SHELL_KEYS.cancel)) {
        space.current = false;
        // Switching tools cancels the outgoing tool in the layout cleanup.
        if (getSession().toolId === 'select') cancel(active);
        else getSession().setToolId('select');
        api.select({ items: [] });
        event.preventDefault();
        return;
      }
      if (matchesShellKey(event, SHELL_KEYS.temporaryPan)) {
        if (event.target instanceof Element && event.target.closest('button, a[href]')) return;
        space.current = true;
        event.preventDefault();
        return;
      }
      if (active.onKey?.(event, api)) {
        event.preventDefault();
        return;
      }
      if (event.altKey) return;
      const key = event.key.toLowerCase();
      const binding = keys?.find(
        (spec) => spec.key.toLowerCase() === key && (spec.shift ?? false) === event.shiftKey,
      );
      if (binding && event.repeat && binding.repeat !== true) {
        event.preventDefault();
        return;
      }
      if (binding?.run(api, getSession().selection)) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey) return;
      const tool = toolset.specs.find((spec) => spec.key?.toLowerCase() === key);
      if (tool) {
        getSession().setToolId(tool.id);
        event.preventDefault();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === SHELL_KEYS.temporaryPan.key) space.current = false;
    }
    function onBlur() {
      space.current = false;
      cancel(active);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [active, api, cancel, keys, toolset]);

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
      onPointerDown={(event) => {
        if (gesture.current || (event.button !== 0 && event.button !== 1)) return;
        const tool = event.button === 1 || space.current ? toolset.pan : active;
        const at = pointer(event, tool === toolset.pan);
        event.preventDefault();
        svg.current?.focus({ preventScroll: true });
        svg.current?.setPointerCapture(event.pointerId);
        gesture.current = { pointerId: event.pointerId, tool };
        tool.onPointerDown(at, api);
      }}
      onPointerMove={(event) => {
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
                {active.overlay?.(api)}
              </LabelObstaclesContext.Provider>
            </SceneTransformContext.Provider>
          </g>
        </g>
      </svg>
    </div>
  );
}
