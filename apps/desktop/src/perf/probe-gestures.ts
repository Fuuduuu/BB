import { boardPads } from '@pcbk/domain';
import type { BoardView, Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import type { createRuntime } from '../runtime';
import { frameStats } from './frame-stats';
import { canvasCounts, nextFrame, sampleFrames, waitFor } from './probe-dom';
import { dragComponent } from './probe-input';
import { saveQuiet } from './probe-workbench';

type Runtime = ReturnType<typeof createRuntime>;
type Component = Snapshot['doc']['components'][number];

export function probeViewportCenter(canvas: SVGSVGElement) {
  const viewport = canvas.parentElement ?? canvas;
  return { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
}

export function probeBaseZoom(doc: Snapshot['doc']): number {
  const minimumShortHalf = Math.min(
    ...doc.components.flatMap((component) =>
      component.board
        ? boardPads(
            component.board,
            component.pins.map((pin) => pin.id),
            doc.scale.pxPerMm,
          ).map((pad) => Math.min(pad.halfPx.x, pad.halfPx.y))
        : [],
    ),
  );
  return Math.max(8 / (1.6 * doc.scale.pxPerMm), 7 / minimumShortHalf) * 1.2;
}

// Observe the same post-zoom window before and after the rendering change.
// Starting immediately preserves the first frame gap; an initial rAF would drop it.
export async function measureZoomSettle() {
  const windowMs = 1000;
  const started = performance.now();
  let previous = started;
  let worstMs = 0;
  let frames = 0;
  do {
    const now = await nextFrame();
    worstMs = Math.max(worstMs, now - previous);
    frames++;
    previous = now;
  } while (previous - started < windowMs);
  return { windowMs, elapsedMs: previous - started, frames, worstMs };
}

function around(center: Vec2, target: Vec2) {
  return (zoom: number, dx = 0, dy = 0): BoardView => ({
    zoom,
    pan: { x: center.x - target.x * zoom + dx, y: center.y - target.y * zoom + dy },
  });
}

export async function measureGestures(
  runtime: Runtime,
  canvas: SVGSVGElement,
  target: Component,
  space: 'board' | 'schematic',
  beforeDrag?: () => void,
) {
  const isBoard = space === 'board';
  const state = useViewStore.getState();
  const baseZoom = isBoard
    ? probeBaseZoom(runtime.engine.snapshot().doc)
    : state.schematicView?.zoom;
  const at = isBoard ? target.board?.center : target.schematic?.at;
  if (!at || !baseZoom) throw new Error(`Probe view target or zoom missing for ${space}`);

  const setView = isBoard ? state.setBoardView : state.setSchematicView;
  const view = around(probeViewportCenter(canvas), at);
  useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: target.id }] });
  setView(view(baseZoom));
  if (isBoard) {
    await waitFor(
      () => canvasCounts(canvas).labels >= 3300,
      'component references and pad numbers',
    );
  }
  await nextFrame();
  await nextFrame();
  await saveQuiet(runtime);

  const pan = frameStats(
    await sampleFrames(180, (frame) =>
      setView(view(baseZoom, Math.sin(frame / 30) * 80, Math.cos(frame / 30) * 50)),
    ),
  );
  await saveQuiet(runtime);
  const zoom = frameStats(
    await sampleFrames(180, (frame) =>
      setView(view(baseZoom * (1 + 0.15 * Math.sin((frame / 180) * Math.PI * 2)))),
    ),
  );
  const zoomSettle = isBoard ? await measureZoomSettle() : undefined;
  await saveQuiet(runtime);
  setView(view(baseZoom));
  await nextFrame();
  await nextFrame();
  await saveQuiet(runtime);

  beforeDrag?.();
  const { intervals, ...drag } = await dragComponent(runtime, canvas, target.id, space);
  await saveQuiet(runtime);
  return {
    pan: { ...pan, budgetFps: isBoard ? 57.2 : 57 },
    zoom: { ...zoom, budgetFps: isBoard ? 58.2 : 57 },
    zoomSettle,
    drag: { ...frameStats(intervals), ...drag, budgetFps: isBoard ? 40.6 : 45 },
    baseZoom,
  };
}
