import { useSessionStore, type SelectionItem } from '@pcbk/ui';
import type { createRuntime } from '../runtime';
import { nextFrame, sampleFrames } from './probe-dom';

type Runtime = ReturnType<typeof createRuntime>;

export function requireBodySelection(selection: SelectionItem[], id: string) {
  if (selection.length !== 1 || selection[0]?.kind !== 'component' || selection[0].id !== id)
    throw new Error('Actual canvas body hit did not select exactly the drag target');
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
  const center = before.doc.components.find((component) => component.id === id)?.board?.center;
  if (!matrix || !center) throw new Error('Drag target or scene matrix missing');
  const start = new DOMPoint(center.x, center.y).matrixTransform(matrix);
  const bounds = svg.getBoundingClientRect();
  if (
    start.x < bounds.left ||
    start.x > bounds.right ||
    start.y < bounds.top ||
    start.y > bounds.bottom
  )
    throw new Error('Drag body center is outside the canvas viewport');
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
    pointer('pointerdown', 0, 0, 1);
    const selection = useSessionStore.getState().selection.items;
    requireBodySelection(selection, id);
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
      previewFrames,
      committed,
      revDelta: after.rev - before.rev,
    };
  } finally {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    restoreCapture();
  }
}
