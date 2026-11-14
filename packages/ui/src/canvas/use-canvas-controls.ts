import { useLayoutEffect, useRef } from 'react';
import type { RefObject, MutableRefObject } from 'react';
import type { BoardView } from '@pcbk/contracts';
import { useViewStore } from '../shell/view-store';
import { useCursorStore } from './cursor-store';
import { pointerWorld, sceneToScreenVector, zoomAt } from './stage';
import type { SceneTransform } from './stage';

interface Controls {
  svg: RefObject<SVGSVGElement>;
  scene: RefObject<SVGGElement>;
  viewRef: MutableRefObject<BoardView>;
  changeView(view: BoardView): void;
  surface?: { width: number; height: number };
  fitInsets?: { left?: number; right?: number; top?: number; bottom?: number };
  sceneTransform: SceneTransform;
  sessionId: string;
  isGesturing(): boolean;
}
export function useCanvasControls(props: Controls) {
  const current = useRef(props);
  useLayoutEffect(() => {
    current.current = props;
  });
  useLayoutEffect(
    () =>
      useViewStore.subscribe((next, previous) => {
        const { svg, surface, fitInsets, sceneTransform, viewRef, changeView, isGesturing } =
          current.current;
        const element = svg.current;
        const fit = next.fitRequest !== previous.fitRequest && next.fitRequest > 0;
        const zoom =
          next.zoomRequest.sequence !== previous.zoomRequest.sequence &&
          next.zoomRequest.sequence > 0;
        if (!element || (!fit && !zoom) || isGesturing()) return;
        const bounds = element.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const available = {
          left: bounds.left + (fitInsets?.left ?? 0),
          right: bounds.right - (fitInsets?.right ?? 0),
          top: bounds.top + (fitInsets?.top ?? 0),
          bottom: bounds.bottom - (fitInsets?.bottom ?? 0),
        };
        // Insets and the 200px fallback are CSS pixels, before root CTM conversion.
        const area = fit && available.right - available.left >= 200 ? available : bounds;
        const start = pointerWorld(element, { x: area.left, y: area.top });
        const end = pointerWorld(element, { x: area.right, y: area.bottom });
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        if (fit) {
          if (!surface || surface.width <= 0 || surface.height <= 0) return;
          const extent = sceneToScreenVector(sceneTransform, {
            x: surface.width,
            y: surface.height,
          });
          const w = Math.abs(extent.x);
          const h = Math.abs(extent.y);
          const scale = Math.min((width * 0.9) / w, (height * 0.9) / h);
          changeView({
            zoom: scale,
            pan: { x: center.x - (w * scale) / 2, y: center.y - (h * scale) / 2 },
          });
        } else {
          const before = viewRef.current;
          const scale = Math.max(
            Math.min(0.05, before.zoom),
            Math.min(Math.max(32, before.zoom), before.zoom * next.zoomRequest.factor),
          );
          changeView(zoomAt(before, center, scale));
        }
      }),
    [],
  );
  useLayoutEffect(() => {
    const element = props.svg.current;
    let frame: number | undefined;
    let lastScreen: { x: number; y: number } | null = null;
    function clear() {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = undefined;
      lastScreen = null;
      if (useCursorStore.getState().world !== null) useCursorStore.setState({ world: null });
    }
    function outside(point: { x: number; y: number }) {
      const bounds = element!.getBoundingClientRect();
      return (
        point.x < bounds.left ||
        point.x > bounds.right ||
        point.y < bounds.top ||
        point.y > bounds.bottom
      );
    }
    function refresh() {
      if (!lastScreen || frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        const scene = current.current.scene.current;
        if (!scene || !lastScreen) return;
        if (outside(lastScreen)) {
          clear();
          return;
        }
        const world = pointerWorld(scene, lastScreen);
        const previous = useCursorStore.getState().world;
        if (previous?.x !== world.x || previous.y !== world.y) useCursorStore.setState({ world });
      });
    }
    function move(event: globalThis.PointerEvent) {
      const point = { x: event.clientX, y: event.clientY };
      if (event.pointerType === 'touch' || outside(point)) {
        clear();
        return;
      }
      lastScreen = point;
      refresh();
    }
    // Observe only the groups/root inputs that affect the pointer's screen CTM.
    // The queued frame reads the committed DOM, after any batched React changes.
    const transforms = new MutationObserver(refresh);
    const scene = props.scene.current;
    if (scene) transforms.observe(scene, { attributes: true, attributeFilter: ['transform'] });
    if (scene?.parentElement)
      transforms.observe(scene.parentElement, { attributes: true, attributeFilter: ['transform'] });
    if (element)
      transforms.observe(element, {
        attributes: true,
        attributeFilter: [
          'viewBox',
          'preserveAspectRatio',
          'transform',
          'width',
          'height',
          'style',
        ],
      });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh);
    if (element) resize?.observe(element);
    window.addEventListener('resize', refresh);
    clear();
    element?.addEventListener('pointermove', move);
    element?.addEventListener('pointerleave', clear);
    element?.addEventListener('pointercancel', clear);
    window.addEventListener('blur', clear);
    return () => {
      clear();
      transforms.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', refresh);
      element?.removeEventListener('pointermove', move);
      element?.removeEventListener('pointerleave', clear);
      element?.removeEventListener('pointercancel', clear);
      window.removeEventListener('blur', clear);
    };
  }, [props.svg, props.sessionId]);
}
