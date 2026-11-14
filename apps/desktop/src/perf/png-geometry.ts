import type { PhotoRef } from '@pcbk/domain';
import { sceneMatrix } from '../../../../packages/ui/src/canvas/stage';

export type ExportMatrix = readonly [number, number, number, number, number, number];

/** Continuous SVG coordinates; a source pixel center is (x + .5, y + .5). */
export function exportMatrix(
  sceneTransform: PhotoRef['transform'],
  surface: { width: number; height: number },
  variantScale: number,
): ExportMatrix {
  const values = sceneMatrix(sceneTransform, surface).slice(7, -1).split(' ').map(Number);
  const [a, b, c, d, e, f] = values as [number, number, number, number, number, number];
  return [
    a * variantScale,
    b * variantScale,
    c * variantScale,
    d * variantScale,
    e * variantScale,
    f * variantScale,
  ];
}
