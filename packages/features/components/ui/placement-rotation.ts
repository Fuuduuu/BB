import { screenToSceneVector } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';

/** Rotate local up to the world vector that appears upright on the screen. */
export function placementRotation(transform: SceneTransform): number {
  const up = screenToSceneVector(transform, { x: 0, y: -1 });
  return ((Math.atan2(up.x, -up.y) * 180) / Math.PI + 360) % 360;
}
