import type { boardPads } from '@pcbk/domain/geometry';

export type BoardPad = ReturnType<typeof boardPads>[number];

export function visiblePadHalf({ halfPx }: BoardPad, zoom: number) {
  return { x: Math.max(halfPx.x, 2.5 / zoom), y: Math.max(halfPx.y, 2.5 / zoom) };
}

export function PadHighlight({
  pad,
  zoom,
  marker,
}: {
  pad: BoardPad;
  zoom: number;
  marker: 'data-trace-target' | 'data-junction-attachment-target';
}) {
  const {
    at: { x, y },
    angleDeg,
    shape,
  } = pad;
  const { x: rx, y: ry } = visiblePadHalf(pad, zoom);
  const transform = `rotate(${angleDeg} ${x} ${y})`;
  const style = {
    [marker]: '',
    stroke: 'var(--sel)',
    fill: 'none',
    strokeWidth: 2,
    vectorEffect: 'non-scaling-stroke',
    transform,
  } as const;
  if (shape === 'circle') {
    return <ellipse {...style} cx={x} cy={y} rx={rx} ry={ry} />;
  }
  return (
    <rect
      {...style}
      x={x - rx}
      y={y - ry}
      width={2 * rx}
      height={2 * ry}
      rx={shape === 'oval' ? Math.min(rx, ry) : undefined}
    />
  );
}
