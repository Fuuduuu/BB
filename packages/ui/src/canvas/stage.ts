import type { PhotoRef, Vec2 } from '@pcbk/domain';

export type SceneTransform = PhotoRef['transform'];

type LinearMatrix = readonly [a: number, b: number, c: number, d: number];

const sceneTransforms: Record<SceneTransform, LinearMatrix> = {
  none: [1, 0, 0, 1],
  rot90: [0, 1, -1, 0],
  rot180: [-1, 0, 0, -1],
  rot270: [0, -1, 1, 0],
  mirror: [-1, 0, 0, 1],
  mirror_rot90: [0, -1, -1, 0],
  mirror_rot180: [1, 0, 0, -1],
  mirror_rot270: [0, 1, 1, 0],
};

export function sceneMatrix(
  transform: SceneTransform,
  surface: { width: number; height: number } = { width: 0, height: 0 },
): string {
  const [a, b, c, d] = sceneTransforms[transform];
  const x = -Math.min(
    0,
    a * surface.width,
    c * surface.height,
    a * surface.width + c * surface.height,
  );
  const y = -Math.min(
    0,
    b * surface.width,
    d * surface.height,
    b * surface.width + d * surface.height,
  );
  return `matrix(${a} ${b} ${c} ${d} ${x} ${y})`;
}

export function sceneToScreenVector(transform: SceneTransform, { x, y }: Vec2): Vec2 {
  const [a, b, c, d] = sceneTransforms[transform];
  return { x: a * x + c * y, y: b * x + d * y };
}

export function screenToSceneVector(transform: SceneTransform, { x, y }: Vec2): Vec2 {
  const [a, b, c, d] = sceneTransforms[transform];
  return { x: a * x + b * y, y: c * x + d * y };
}

/** Keep the text anchor in the scene while cancelling its rotation and reflection. */
export function sceneTextMatrix(transform: SceneTransform, { x, y }: Vec2): string {
  const [a, b, c, d] = sceneTransforms[transform];
  // Orthogonal matrices invert by transposition. Offset the inverse to fix the anchor.
  return `matrix(${a} ${c} ${b} ${d} ${x - a * x - b * y} ${y - c * x - d * y})`;
}

export function pointerWorld(scene: SVGGraphicsElement, { x, y }: Vec2): Vec2 {
  const matrix = scene.getScreenCTM();
  if (!matrix) throw new Error('Cannot map a pointer without an SVG screen matrix');
  const { a, b, c, d, e, f } = matrix.inverse();
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

type View = { zoom: number; pan: Vec2 };

export function viewMatrix({ zoom, pan }: View): string {
  return `matrix(${zoom} 0 0 ${zoom} ${pan.x} ${pan.y})`;
}

/** Change zoom around a point in the root SVG's coordinate system. */
export function zoomAt(view: View, at: Vec2, nextZoom: number): View {
  const scale = nextZoom / view.zoom;
  return {
    zoom: nextZoom,
    pan: {
      x: at.x - (at.x - view.pan.x) * scale,
      y: at.y - (at.y - view.pan.y) * scale,
    },
  };
}
