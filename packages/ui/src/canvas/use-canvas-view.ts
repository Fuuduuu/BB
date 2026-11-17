import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { BoardView } from '@pcbk/contracts';
import { viewMatrix } from './stage';

export const GESTURE_OVERSCAN = 0.25;

/** Keep the SVG sharp view fixed while its bitmap follows the live view. */
export function useCanvasView(
  view: BoardView,
  svg: RefObject<SVGSVGElement>,
  group: RefObject<SVGGElement>,
) {
  const viewRef = useRef(view);
  const committedView = useRef(view);
  const [lodZoom, setLodZoom] = useState(view.zoom);
  const delay = useRef<number>();
  const frame = useRef<number>();
  const buffer = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const cancelLod = useCallback(() => {
    window.clearTimeout(delay.current);
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
    delay.current = undefined;
    frame.current = undefined;
  }, []);
  useLayoutEffect(() => {
    group.current?.setAttribute('transform', viewMatrix(committedView.current));
    return cancelLod;
  }, [cancelLod, group]);
  const renderGesture = useCallback(
    (next: BoardView) => {
      const committed = committedView.current;
      const scale = next.zoom / committed.zoom;
      const dx = next.pan.x - scale * committed.pan.x;
      const dy = next.pan.y - scale * committed.pan.y;
      const { width, height, x, y } = buffer.current;
      // Test the transformed buffer edges, including zooms away from the centre.
      const exceeded =
        width > 0 &&
        height > 0 &&
        (dx - scale * x > 1e-6 ||
          dy - scale * y > 1e-6 ||
          dx + scale * (width + x) < width - 1e-6 ||
          dy + scale * (height + y) < height - 1e-6);
      if (exceeded) {
        committedView.current = next;
        group.current?.setAttribute('transform', viewMatrix(next));
      }
      if (svg.current) {
        svg.current.style.transform = exceeded
          ? 'matrix(1, 0, 0, 1, 0, 0)'
          : `matrix(${scale}, 0, 0, ${scale}, ${dx + (1 - scale) * x}, ${dy + (1 - scale) * y})`;
        svg.current.style.willChange = 'transform';
      }
    },
    [group, svg],
  );
  const configureBuffer = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      const x = width * GESTURE_OVERSCAN;
      const y = height * GESTURE_OVERSCAN;
      buffer.current = { width, height, x, y };
      svg.current?.setAttribute('viewBox', `${-x} ${-y} ${width + 2 * x} ${height + 2 * y}`);
      if (svg.current?.style.transform) renderGesture(viewRef.current);
    },
    [renderGesture, svg],
  );
  const applyView = useCallback(
    (next: BoardView) => {
      const previous = viewRef.current;
      viewRef.current = next;
      if (
        previous.zoom === next.zoom &&
        previous.pan.x === next.pan.x &&
        previous.pan.y === next.pan.y
      )
        return;
      renderGesture(next);
      cancelLod();
      delay.current = window.setTimeout(() => {
        delay.current = undefined;
        frame.current = window.requestAnimationFrame(() => {
          frame.current = undefined;
          const live = viewRef.current;
          // Commit geometry, compositor cleanup and LOD before the same paint.
          flushSync(() => {
            committedView.current = live;
            group.current?.setAttribute('transform', viewMatrix(live));
            svg.current?.style.removeProperty('transform');
            svg.current?.style.removeProperty('will-change');
            setLodZoom(live.zoom);
          });
        });
      }, 120);
    },
    [cancelLod, group, renderGesture, svg],
  );
  return { viewRef, lodZoom, applyView, configureBuffer };
}
