import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { Vec2 } from '@pcbk/domain';
import { visibleCanvasBounds, type CanvasInsets } from './use-canvas-context-menu';

type CanvasHudGeometry = {
  viewport: RefObject<HTMLDivElement>;
  scene: RefObject<SVGGElement>;
  fitInsets?: CanvasInsets;
};

const CanvasHudContext = createContext<CanvasHudGeometry | null>(null);
export const CanvasHud = CanvasHudContext.Provider;

const gap = 8;

function placeHud(
  hud: HTMLDivElement,
  viewport: HTMLDivElement,
  scene: SVGGElement,
  at: Vec2,
  fitInsets?: CanvasInsets,
) {
  const matrix = scene.getScreenCTM?.();
  if (!matrix) return;
  const { a, b, c, d, e, f } = matrix;
  const x = a * at.x + c * at.y + e;
  const y = b * at.x + d * at.y + f;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const bounds = viewport.getBoundingClientRect();
  const visible = visibleCanvasBounds(bounds, fitInsets);
  hud.style.maxWidth = `${visible.width}px`;
  hud.style.maxHeight = `${visible.height}px`;
  const width = hud.offsetWidth;
  const height = hud.offsetHeight;
  const nextLeft = x + gap + width <= visible.left + visible.width ? x + gap : x - gap - width;
  const left = Math.max(0, Math.min(nextLeft - visible.left, visible.width - width));
  const top = Math.max(0, Math.min(y + gap - visible.top, visible.height - height));
  hud.style.left = `${visible.left - bounds.left + left}px`;
  hud.style.top = `${visible.top - bounds.top + top}px`;
}

export function CanvasHudAnchor({ at: { x, y }, children }: { at: Vec2; children: ReactNode }) {
  const { viewport, scene, fitInsets } = useContext(CanvasHudContext) ?? {};
  const element = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!viewport || !scene) return;
    const mount = () => {
      const hud = element.current;
      const parent = viewport.current;
      const origin = scene.current;
      if (!hud || !parent || !origin) return;
      const position = () => placeHud(hud, parent, origin, { x, y }, fitInsets);
      position();

      const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
      resize?.observe(parent);
      resize?.observe(hud);
      const transform = new MutationObserver(position);
      transform.observe(origin, { attributeFilter: ['transform'] });
      if (origin.parentElement)
        transform.observe(origin.parentElement, { attributeFilter: ['transform'] });
      if (origin.ownerSVGElement) {
        transform.observe(origin.ownerSVGElement, { attributeFilter: ['style', 'viewBox'] });
      }
      return () => {
        resize?.disconnect();
        transform.disconnect();
      };
    };

    let cleanup = mount();
    if (cleanup) return cleanup;
    // An ancestor's viewport ref can attach after this child's first layout effect.
    const frame = window.requestAnimationFrame(() => {
      cleanup = mount();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [fitInsets, scene, viewport, x, y]);

  return (
    <div
      data-canvas-hud=""
      ref={element}
      style={{ position: 'absolute', zIndex: 4, width: 'max-content', overflow: 'auto' }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
