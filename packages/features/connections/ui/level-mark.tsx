import type { Vec2 } from '@pcbk/domain';
import { drawingSegmentPoints } from '@pcbk/domain/geometry';
import { SceneText } from '@pcbk/ui';

export function drawingMidpoint(points: readonly Vec2[], wire: boolean, zoom: number): Vec2 {
  const first = points[0]!;
  const centerline = wire
    ? [
        first,
        ...points
          .slice(1)
          .flatMap((end, index) =>
            drawingSegmentPoints(points[index]!, end, 'wire', zoom).slice(1),
          ),
      ]
    : points;
  const lengths = centerline.slice(1).map((end, index) => {
    const start = centerline[index]!;
    return Math.hypot(end.x - start.x, end.y - start.y);
  });
  let distance = lengths.reduce((total, length) => total + length, 0) / 2;
  for (const [index, length] of lengths.entries()) {
    if (length === 0) continue;
    if (distance <= length) {
      const start = centerline[index]!;
      const end = centerline[index + 1]!;
      const fraction = distance / length;
      return {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
      };
    }
    distance -= length;
  }
  return first;
}

export function LevelMark({
  at,
  color,
  zoom,
  opacity,
}: {
  at: Vec2;
  color: string;
  zoom: number;
  opacity?: number;
}) {
  return (
    <SceneText
      x={at.x}
      y={at.y}
      fontSize={11 / zoom}
      fontFamily="var(--f-mono)"
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      opacity={opacity}
      stroke="var(--halo)"
      strokeWidth={2}
      paintOrder="stroke"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    >
      ✓
    </SceneText>
  );
}
