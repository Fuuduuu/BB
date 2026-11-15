import { memo } from 'react';
import type { Pin, Vec2 } from '@pcbk/domain';
import { SceneText } from '@pcbk/ui';

type PinGeometry = {
  x: number;
  y: number;
  halfPx: Vec2;
  angleDeg: number;
  shape: 'rect' | 'circle' | 'oval';
  zoom: number;
};
type PadOutlineProps = Omit<PinGeometry, 'zoom'> & {
  stroke: string;
  strokeWidth: number;
};

export function PadOutline({
  x,
  y,
  halfPx,
  angleDeg,
  shape,
  stroke,
  strokeWidth,
}: PadOutlineProps) {
  const style = { fill: 'none', stroke, strokeWidth, vectorEffect: 'non-scaling-stroke' };
  return shape !== 'circle' ? (
    <rect
      x={x - halfPx.x}
      y={y - halfPx.y}
      width={2 * halfPx.x}
      height={2 * halfPx.y}
      rx={shape === 'oval' ? Math.min(halfPx.x, halfPx.y) : undefined}
      transform={`rotate(${angleDeg} ${x} ${y})`}
      {...style}
    />
  ) : (
    <circle cx={x} cy={y} r={halfPx.x} {...style} />
  );
}

type PinMarkerProps = PinGeometry & {
  pin: Readonly<Pin>;
  selected: boolean;
};

export const PinMarker = memo(function PinMarker({
  pin,
  x,
  y,
  halfPx,
  angleDeg,
  shape,
  zoom,
  selected,
}: PinMarkerProps) {
  const outline = { x, y, halfPx, angleDeg, shape };
  const strokeWidth = pin.nc ? 1 : 1.5;
  return (
    <g data-pin={pin.id}>
      <PadOutline {...outline} stroke="var(--halo)" strokeWidth={strokeWidth + 3} />
      <PadOutline {...outline} stroke="var(--ink-3)" strokeWidth={strokeWidth} />
      {selected && (
        <PadOutline
          {...outline}
          halfPx={{ x: halfPx.x + 2 / zoom, y: halfPx.y + 2 / zoom }}
          stroke="var(--sel)"
          strokeWidth={2}
        />
      )}
    </g>
  );
});

function NcCross({ x, y, halfPx, angleDeg, shape, zoom }: PinGeometry) {
  const halfLength = 3 / zoom;
  const centerX = x + halfPx.x;
  const centerY = y - (shape === 'circle' ? halfPx.x : halfPx.y);
  const left = centerX - halfLength;
  const right = centerX + halfLength;
  const top = centerY - halfLength;
  const bottom = centerY + halfLength;
  const geometry = {
    d: `M${left},${top} L${right},${bottom} M${right},${top} L${left},${bottom}`,
    transform: `rotate(${angleDeg} ${x} ${y})`,
    fill: 'none',
    vectorEffect: 'non-scaling-stroke',
  };
  return (
    <>
      <path {...geometry} stroke="var(--halo)" strokeWidth={3.5} />
      <path {...geometry} stroke="var(--ink-3)" strokeWidth={1.5} />
    </>
  );
}

export const PinLabels = memo(function PinLabels({
  pin,
  x,
  y,
  halfPx,
  angleDeg,
  shape,
  zoom,
}: PinGeometry & { pin: Readonly<Pin> }) {
  const shortHalf = Math.min(halfPx.x, halfPx.y);
  const nameOffset = (shape === 'circle' ? halfPx.x : Math.hypot(halfPx.x, halfPx.y)) + 2 / zoom;
  const screenHalf = shortHalf * zoom;
  const showNumber = screenHalf >= 7;
  if (!showNumber && !pin.nc) return null;
  const textProps = {
    x,
    y,
    fontSize: Math.max(shortHalf, 8 / zoom),
    fontFamily: 'var(--f-mono)',
    dominantBaseline: 'central' as const,
    fill: 'var(--ink)',
    stroke: 'var(--halo)',
    strokeWidth: 2,
    paintOrder: 'stroke',
    vectorEffect: 'non-scaling-stroke',
    style: { fontVariantNumeric: 'tabular-nums' },
  };
  return (
    <>
      {showNumber && (
        <SceneText {...textProps} textAnchor="middle">
          {pin.id}
        </SceneText>
      )}
      {screenHalf >= 14 && pin.name && (
        <SceneText {...textProps} dx={nameOffset}>
          {pin.name}
        </SceneText>
      )}
      {pin.nc && (
        <NcCross x={x} y={y} halfPx={halfPx} angleDeg={angleDeg} shape={shape} zoom={zoom} />
      )}
    </>
  );
});
