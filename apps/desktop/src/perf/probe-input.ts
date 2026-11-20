import { bodyOutline } from '@pcbk/domain/geometry';
import { useSessionStore, type SelectionItem } from '@pcbk/ui';
import type { createRuntime } from '../runtime';
import { nextFrame, sampleFrames } from './probe-dom';

type Runtime = ReturnType<typeof createRuntime>;

export function requireBodySelection(selection: SelectionItem[], id: string) {
  if (!selectedBody(selection, id))
    throw new Error('Actual canvas body hit did not select exactly the drag target');
}

function selectedBody(selection: SelectionItem[], id: string) {
  return selection.length === 1 && selection[0]?.kind === 'component' && selection[0].id === id;
}

// Synthetic events have no native active pointer. Only capture bookkeeping is
// emulated; Canvas's React handlers, scene hit index and SelectTool stay real.
function syntheticCapture(svg: SVGSVGElement) {
  const keys = ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture'] as const;
  const previous = keys.map((key) => Object.getOwnPropertyDescriptor(svg, key));
  const captured = new Set<number>();
  Object.defineProperties(svg, {
    setPointerCapture: { configurable: true, value: (id: number) => captured.add(id) },
    hasPointerCapture: { configurable: true, value: (id: number) => captured.has(id) },
    releasePointerCapture: { configurable: true, value: (id: number) => captured.delete(id) },
  });
  return () =>
    keys.forEach((key, index) => {
      const descriptor = previous[index];
      if (descriptor) Object.defineProperty(svg, key, descriptor);
      else delete svg[key];
    });
}

export async function dragComponent(runtime: Runtime, svg: SVGSVGElement, id: string) {
  const scene = svg.querySelector<SVGGElement>('[data-scene]');
  const matrix = scene?.getScreenCTM();
  const before = runtime.engine.snapshot();
  const board = before.doc.components.find((component) => component.id === id)?.board;
  const bounds = svg.parentElement?.getBoundingClientRect();
  if (!matrix || !board || !bounds) throw new Error('Drag target or scene matrix missing');
  const { center } = board;
  const outline = bodyOutline(board, before.doc.scale.pxPerMm);
  const candidates = [
    center,
    ...outline.map((corner) => ({
      x: (center.x + corner.x) / 2,
      y: (center.y + corner.y) / 2,
    })),
  ]
    .map(({ x, y }) => new DOMPoint(x, y).matrixTransform(matrix))
    .filter(
      ({ x, y }) => x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom,
    );
  if (!candidates.length) throw new Error('Drag body is outside the canvas viewport');
  let start = candidates[0]!;
  let bodyHitAttempts = 0;
  const pointer = (type: string, dx: number, dy: number, buttons: number) =>
    svg.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 7841,
        pointerType: 'mouse',
        isPrimary: true,
        clientX: start.x + dx,
        clientY: start.y + dy,
        button: 0,
        buttons,
      }),
    );
  const restoreCapture = syntheticCapture(svg);
  let previewFrames = 0;
  try {
    useSessionStore.getState().setToolId('select');
    useSessionStore.getState().setSelection({ items: [] });
    await nextFrame();
    for (const point of candidates) {
      start = point;
      bodyHitAttempts++;
      pointer('pointerdown', 0, 0, 1);
      if (selectedBody(useSessionStore.getState().selection.items, id)) break;
      // A trace may cover the centre. Release without moving before trying another body point.
      pointer('pointerup', 0, 0, 0);
      useSessionStore.getState().setSelection({ items: [] });
      await nextFrame();
    }
    requireBodySelection(useSessionStore.getState().selection.items, id);
    if (runtime.engine.snapshot().rev !== before.rev)
      throw new Error('Drag targeting changed the document');
    const intervals = await sampleFrames(120, (frame) => {
      pointer('pointermove', (frame + 1) * 0.5, (frame + 1) * 0.2, 1);
      if (useSessionStore.getState().preview?.owner === 'select') previewFrames++;
    });
    pointer('pointerup', 60, 24, 0);
    await nextFrame();
    const after = runtime.engine.snapshot();
    const end = after.doc.components.find((component) => component.id === id)?.board?.center;
    const offset = new DOMPoint(60, 24).matrixTransform(matrix.inverse());
    const zero = new DOMPoint(0, 0).matrixTransform(matrix.inverse());
    const committed =
      after.rev === before.rev + 1 &&
      end !== undefined &&
      Math.abs(end.x - center.x - (offset.x - zero.x)) < 0.001 &&
      Math.abs(end.y - center.y - (offset.y - zero.y)) < 0.001 &&
      useSessionStore.getState().preview === null;
    if (!committed || previewFrames < 110)
      throw new Error(
        `Drag pipeline failed: committed=${committed}; previewFrames=${previewFrames}`,
      );
    return {
      intervals,
      captureShim: true,
      bodyHitAttempts,
      previewFrames,
      committed,
      revDelta: after.rev - before.rev,
    };
  } finally {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    restoreCapture();
  }
}
