import type { PhotoRef } from '@pcbk/domain';

type Transform = PhotoRef['transform'];
type Matrix = readonly [a: number, b: number, c: number, d: number];

// Same linear matrices as the canvas scene. Operations compose in screen space.
const matrices: Record<Transform, Matrix> = {
  none: [1, 0, 0, 1],
  rot90: [0, 1, -1, 0],
  rot180: [-1, 0, 0, -1],
  rot270: [0, -1, 1, 0],
  mirror: [-1, 0, 0, 1],
  mirror_rot90: [0, -1, -1, 0],
  mirror_rot180: [1, 0, 0, -1],
  mirror_rot270: [0, 1, 1, 0],
};

function compose(operation: Matrix, transform: Transform): Transform {
  const [a, b, c, d] = operation;
  const [e, f, g, h] = matrices[transform];
  const result = [a * e + c * f, b * e + d * f, a * g + c * h, b * g + d * h];
  return (Object.keys(matrices) as Transform[]).find((key) =>
    matrices[key].every((value, index) => value === result[index]),
  )!;
}

export function rotateClockwise(transform: Transform): Transform {
  return compose(matrices.rot90, transform);
}

export function mirrorHorizontal(transform: Transform): Transform {
  return compose(matrices.mirror, transform);
}
