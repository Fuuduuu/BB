import type { Vec2 } from '@pcbk/domain';
import { createContext, useContext } from 'react';
import { sceneToScreenVector } from './stage';
import type { SceneTransform } from './stage';

/** Screen-aligned bounds, with scene center and half extents along screen axes in scene units. */
export interface LabelObstacle {
  owner: string;
  componentId?: string;
  center: Vec2;
  half: Vec2;
}

/** Calibrated against the application's Martian Mono font in Chromium. */
export const MONO_ADVANCE_EM = 0.72;
export const MONO_LINE_EM = 1.25;

/** Conservative mono-font bounds including halo and one screen pixel of safety on each side. */
export function monoLabelHalf(text: string, fontSize: number, zoom: number, haloPx = 2): Vec2 {
  const padding = (haloPx / 2 + 1) / zoom;
  return {
    x: (Array.from(text).length * MONO_ADVANCE_EM * fontSize) / 2 + padding,
    y: (MONO_LINE_EM * fontSize) / 2 + padding,
  };
}

export const LabelObstaclesContext = createContext<readonly LabelObstacle[]>([]);

export function useLabelObstacles(): readonly LabelObstacle[] {
  return useContext(LabelObstaclesContext);
}

export function screenBoxesOverlap(
  a: LabelObstacle,
  b: LabelObstacle,
  transform: SceneTransform,
): boolean {
  const delta = sceneToScreenVector(transform, {
    x: a.center.x - b.center.x,
    y: a.center.y - b.center.y,
  });
  return Math.abs(delta.x) < a.half.x + b.half.x && Math.abs(delta.y) < a.half.y + b.half.y;
}
