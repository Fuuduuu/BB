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
  return (
    <g data-pin={pin.id}>
      <PadOutline {...outline} stroke="var(--halo)" strokeWidth={strokeWidth + 3} />
      <PadOutline {...outline} stroke="var(--ink-3)" strokeWidth={strokeWidth} />
      {selected && (
        <PadOutline {...outline} radius={radius + 2 / zoom} stroke="var(--sel)" strokeWidth={2} />
      )}
    </g>
  );
});

function NcCross({ x, y, radius, zoom }: PinGeometry) {
  const halfLength = 3 / zoom;
  const centerX = x + radius;
  const centerY = y - radius;
  const left = centerX - halfLength;
  const right = centerX + halfLength;
  const top = centerY - halfLength;
  const bottom = centerY + halfLength;
  const geometry = {
    d: `M${left},${top} L${right},${bottom} M${right},${top} L${left},${bottom}`,
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
  radius,
  zoom,
}: PinGeometry & { pin: Readonly<Pin> }) {
  const screenRadius = radius * zoom;
  const showNumber = screenRadius >= 7;
  if (!showNumber && !pin.nc) return null;
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
      {showNumber && (
        <SceneText {...textProps} textAnchor="middle">
          {pin.id}
        </SceneText>
      )}
      {screenRadius >= 14 && pin.name && (
        <SceneText {...textProps} dx={radius + 2 / zoom}>
          {pin.name}
        </SceneText>
      )}
      {pin.nc && <NcCross x={x} y={y} radius={radius} zoom={zoom} />}
    </>
  );
});
