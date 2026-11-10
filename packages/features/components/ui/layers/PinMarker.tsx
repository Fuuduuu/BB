import { memo } from 'react';
import type { Pin } from '@pcbk/domain';
import { SceneText } from '@pcbk/ui';

type PinGeometry = { x: number; y: number; radius: number; zoom: number };
type PadOutlineProps = Pick<PinGeometry, 'x' | 'y' | 'radius'> & {
  square: boolean;
  stroke: string;
  strokeWidth: number;
};

function PadOutline({ x, y, radius, square, stroke, strokeWidth }: PadOutlineProps) {
  const style = { fill: 'none', stroke, strokeWidth, vectorEffect: 'non-scaling-stroke' };
  return square ? (
    <rect x={x - radius} y={y - radius} width={2 * radius} height={2 * radius} {...style} />
  ) : (
    <circle cx={x} cy={y} r={radius} {...style} />
  );
}

type PinMarkerProps = PinGeometry & {
  pin: Readonly<Pin>;
  square: boolean;
  selected: boolean;
};

export const PinMarker = memo(function PinMarker({
  pin,
  x,
  y,
  radius,
  zoom,
  square,
  selected,
}: PinMarkerProps) {
  const outline = { x, y, radius, square };
  const strokeWidth = pin.nc ? 1 : 1.5;
  const crossHalf = Math.min(radius * 0.45, 4 / zoom);
  return (
    <g data-pin={pin.id}>
      <PadOutline {...outline} stroke="var(--halo)" strokeWidth={strokeWidth + 3} />
      <PadOutline {...outline} stroke="var(--ink-3)" strokeWidth={strokeWidth} />
      {pin.nc && (
        <path
          d={`M${x - crossHalf},${y - crossHalf} l${2 * crossHalf},${2 * crossHalf} M${x + crossHalf},${y - crossHalf} l${-2 * crossHalf},${2 * crossHalf}`}
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {selected && (
        <PadOutline {...outline} radius={radius + 2 / zoom} stroke="var(--sel)" strokeWidth={2} />
      )}
    </g>
  );
});

export const PinText = memo(function PinText({
  pin,
  x,
  y,
  radius,
  zoom,
}: PinGeometry & { pin: Readonly<Pin> }) {
  const screenRadius = radius * zoom;
  if (screenRadius < 7) return null;
  const textProps = {
    x,
    y,
    fontSize: Math.max(radius, 8 / zoom),
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
      <SceneText {...textProps} textAnchor="middle">
        {pin.id}
      </SceneText>
      {screenRadius >= 14 && pin.name && (
        <SceneText {...textProps} dx={radius + 2 / zoom}>
          {pin.name}
        </SceneText>
      )}
    </>
  );
});
