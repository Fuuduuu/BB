import { Fragment, memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { DocumentEngine, Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { et } from '../shell/i18n/et';
import { isEditing } from '../shell/keymap';
import { useSessionStore } from '../shell/session-store';
import type { Preview } from '../shell/session-store';
import type { KeySpec } from '../shell/UiRegistry';
import { createHitIndex } from './hit-index';
import { createPanToolSpec } from './PanTool';
import { createSelectToolSpec } from './SelectTool';
import { SceneTransformContext } from './scene-text';
import { pointerWorld, sceneMatrix, viewMatrix, zoomAt } from './stage';
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
}

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
      <Fragment key={layer.id}>{layer.render({ snapshot, preview, zoom: lodZoom })}</Fragment>
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
}: CanvasProps) {
  const svg = useRef<SVGSVGElement>(null);
  const viewGroup = useRef<SVGGElement>(null);
  const scene = useRef<SVGGElement>(null);
  const viewRef = useRef(view);
  const [lodZoom, setLodZoom] = useState(view.zoom);
  const lodDelay = useRef<number>();
  const lodFrame = useRef<number>();
  const current = useRef({ snapshot, execute, onViewChange });
  const cache = useRef<{
    layers: typeof layers;
    rev: number;
    sessionId: string;
    lodZoom: number;
    index: ReturnType<typeof createHitIndex>;
  }>();
  const gesture = useRef<{ pointerId: number; tool: CanvasTool } | null>(null);
  const space = useRef(false);
  const preview = useSessionStore((store) => store.preview);
  const toolId = useSessionStore((store) => store.toolId);

  const cancelLod = useCallback(() => {
    window.clearTimeout(lodDelay.current);
    if (lodFrame.current !== undefined) window.cancelAnimationFrame(lodFrame.current);
    lodDelay.current = undefined;
    lodFrame.current = undefined;
  }, []);
  const applyView = useCallback(
    (next: CanvasView) => {
      const previous = viewRef.current;
      viewRef.current = next;
      viewGroup.current?.setAttribute('transform', viewMatrix(next));

      const panChanged = previous.pan.x !== next.pan.x || previous.pan.y !== next.pan.y;
      const lodPending = lodDelay.current !== undefined || lodFrame.current !== undefined;
      if (next.zoom === previous.zoom && !(lodPending && panChanged)) return;

      cancelLod();
      lodDelay.current = window.setTimeout(() => {
        lodDelay.current = undefined;
        lodFrame.current = window.requestAnimationFrame(() => {
          lodFrame.current = undefined;
          setLodZoom(next.zoom);
        });
      }, 120);
    },
    [cancelLod],
  );
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
  const panByScreen = useCallback(
    (delta: Vec2) => {
      if (!svg.current) return;
      const zero = pointerWorld(svg.current, { x: 0, y: 0 });
      const end = pointerWorld(svg.current, delta);
      const { zoom, pan } = viewRef.current;
      changeView({ zoom, pan: { x: pan.x + end.x - zero.x, y: pan.y + end.y - zero.y } });
    },
    [changeView],
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
    }),
    [emptyHits],
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
    const previous = cache.current;
    if (
      previous?.layers !== layers ||
      previous.rev !== snapshot.rev ||
      previous.sessionId !== snapshot.sessionId ||
      previous.lodZoom !== lodZoom
    ) {
      cache.current = {
        layers,
        rev: snapshot.rev,
        sessionId: snapshot.sessionId,
        lodZoom,
        index: createHitIndex(layers.flatMap((layer) => layer.hits?.(snapshot, lodZoom) ?? [])),
      };
    }
  }, [active, cancel, layers, snapshot, execute, onViewChange, lodZoom]);
  useLayoutEffect(() => cancelLod, [cancelLod]);
  useLayoutEffect(() => applyView(view), [applyView, view]);
  useLayoutEffect(
    () => () => {
      space.current = false;
      cancel(active);
    },
    [active, cancel, snapshot.sessionId, toolId],
  );

  useLayoutEffect(() => {
    const element = svg.current;
    if (!element) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (!element || gesture.current || !Number.isFinite(event.deltaY)) return;
      const before = viewRef.current;
      const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      const zoom = Math.max(
        Math.min(0.05, before.zoom),
        Math.min(Math.max(32, before.zoom), before.zoom * Math.exp(-event.deltaY * step * 0.002)),
      );
      const at = pointerWorld(element, { x: event.clientX, y: event.clientY });
      changeView(zoomAt(before, at, zoom));
    }
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [changeView]);

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
      if (event.key === 'Escape') {
        space.current = false;
        // Switching tools cancels the outgoing tool in the layout cleanup.
        if (getSession().toolId === 'select') cancel(active);
        else getSession().setToolId('select');
        api.select({ items: [] });
        event.preventDefault();
        return;
      }
      if (!event.altKey && event.key === ' ') {
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
      if (event.key === ' ') space.current = false;
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

  function pointer(event: PointerEvent<SVGSVGElement>): CanvasPointer {
    const screen = { x: event.clientX, y: event.clientY };
    const world = pointerWorld(scene.current!, screen);
    return {
      screen,
      world,
      hit: api.hitIndex.query(world, viewRef.current.zoom),
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey,
    };
  }

  return (
    <svg
      ref={svg}
      tabIndex={0}
      aria-label={et.shell.canvas}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        touchAction: 'none',
        cursor: active.cursor,
      }}
      onPointerDown={(event) => {
        if (gesture.current || (event.button !== 0 && event.button !== 1)) return;
        const tool = event.button === 1 || space.current ? toolset.pan : active;
        const at = pointer(event);
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { pointerId: event.pointerId, tool };
        tool.onPointerDown(at, api);
      }}
      onPointerMove={(event) => {
        const down = gesture.current;
        if (down && down.pointerId !== event.pointerId) return;
        (down?.tool ?? active).onPointerMove(pointer(event), api);
      }}
      onPointerUp={(event) => {
        const down = gesture.current;
        if (!down || down.pointerId !== event.pointerId) return;
        gesture.current = null;
        try {
          down.tool.onPointerUp(pointer(event), api);
        } finally {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
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
      <g ref={viewGroup} data-view="">
        <g ref={scene} data-scene="" transform={sceneMatrix(sceneTransform)}>
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
            <Layers layers={layers} snapshot={snapshot} preview={preview} lodZoom={lodZoom} />
            {active.overlay?.(api)}
          </SceneTransformContext.Provider>
        </g>
      </g>
    </svg>
  );
}
