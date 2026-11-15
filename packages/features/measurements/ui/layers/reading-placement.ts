import type { Vec2 } from '@pcbk/domain';
import { screenBoxesOverlap, screenToSceneVector } from '@pcbk/ui';
import type { LabelObstacle, SceneTransform } from '@pcbk/ui';

interface ReadingPlacementInput {
  at: Vec2;
  half: Vec2;
  textSize: number;
  radius: number;
  labelOffset: number;
  isLeft: boolean;
  obstacles: readonly LabelObstacle[];
  placed: readonly LabelObstacle[];
  transform: SceneTransform;
}

export interface ReadingPlacement {
  box: LabelObstacle;
  offset: Vec2;
  textAnchor: 'start' | 'end';
  leader?: { start: Vec2; end: Vec2 };
}

/** Choose screen-aligned candidates in a fixed order; never move a component label. */
export function placeReadingLabel({
  at,
  half,
  textSize,
  radius,
  labelOffset,
  isLeft,
  obstacles,
  placed,
  transform,
}: ReadingPlacementInput): ReadingPlacement {
  const directions = [
    [isLeft ? -1 : 1, -1],
    [isLeft ? 1 : -1, -1],
    [1, 1],
    [-1, 1],
  ];
  let fallback: ReadingPlacement | undefined;
  for (let ring = 0; ring <= 3; ring++) {
    for (const [side = 1, vertical = -1] of directions) {
      const distance = labelOffset + ring * textSize;
      const offset = { x: side * distance, y: vertical * distance };
      const center = { x: offset.x + side * half.x, y: offset.y };
      const delta = screenToSceneVector(transform, center);
      const candidate: ReadingPlacement = {
        box: {
          owner: 'measurements.reading',
          center: { x: at.x + delta.x, y: at.y + delta.y },
          half,
        },
        offset,
        textAnchor: side < 0 ? 'end' : 'start',
      };
      fallback ??= candidate;
      if (
        [...obstacles, ...placed].some((box) => screenBoxesOverlap(candidate.box, box, transform))
      )
        continue;
      if (ring > 0) {
        const nearest = {
          x: Math.max(center.x - half.x, Math.min(0, center.x + half.x)),
          y: Math.max(center.y - half.y, Math.min(0, center.y + half.y)),
        };
        const length = Math.hypot(nearest.x, nearest.y);
        const start = screenToSceneVector(transform, {
          x: (nearest.x * radius) / length,
          y: (nearest.y * radius) / length,
        });
        const end = screenToSceneVector(transform, nearest);
        candidate.leader = {
          start: { x: at.x + start.x, y: at.y + start.y },
          end: { x: at.x + end.x, y: at.y + end.y },
        };
      }
      return candidate;
    }
  }
  return fallback!;
}
