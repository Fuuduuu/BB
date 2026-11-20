import { SceneText } from '@pcbk/ui';
import { wirePath } from './connection-geometry';
import { connectionsEt } from './i18n/et';
import { distance } from './trace-geometry';
import type { DrawingHit, EndpointHit } from './trace-geometry';
import { useTraceStore } from './trace-store';

const highlight = {
  'data-trace-target': '',
  stroke: 'var(--sel)',
  fill: 'none',
  strokeWidth: 2,
  vectorEffect: 'non-scaling-stroke',
} as const;

function TraceTarget({ target, zoom }: { target: EndpointHit | DrawingHit; zoom: number }) {
  if ('segment' in target) {
    const { a, b, kind } = target;
    return kind === 'wire' ? (
      <path {...highlight} d={wirePath([a, b])} />
    ) : (
      <line {...highlight} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
    );
  }
  const { outline } = target;
  if (outline.type === 'junction') {
    return <circle {...highlight} cx={outline.at.x} cy={outline.at.y} r={outline.radius} />;
  }
  const {
    at: { x, y },
    halfPx,
    angleDeg,
    shape,
  } = outline.pad;
  const rx = Math.max(halfPx.x, 2.5 / zoom);
  const ry = Math.max(halfPx.y, 2.5 / zoom);
  const transform = `rotate(${angleDeg} ${x} ${y})`;
  if (shape === 'circle') {
    return <ellipse {...highlight} cx={x} cy={y} rx={rx} ry={ry} transform={transform} />;
  }
  return (
    <rect
      {...highlight}
      x={x - rx}
      y={y - ry}
      width={2 * rx}
      height={2 * ry}
      rx={shape === 'oval' ? Math.min(rx, ry) : undefined}
      transform={transform}
    />
  );
}

export function TraceOverlay() {
  const preview = useTraceStore((state) => state.preview);
  const mode = useTraceStore((state) => state.mode);
  if (!preview) return null;
  const { points: confirmed, cursor: end, target, pxPerMm, zoom } = preview;
  const start = confirmed.at(-1);
  const points = end ? [...confirmed, end] : confirmed;
  const length = start && end ? distance(start, end) / pxPerMm : 0;
  const stroke = mode.kind === 'wire' ? 'var(--wire)' : `var(--${mode.layer})`;
  const style = {
    fill: 'none',
    stroke,
    strokeWidth: 2,
    vectorEffect: 'non-scaling-stroke',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <g data-trace-preview="" pointerEvents="none" aria-hidden="true">
      {mode.kind === 'wire' ? (
        <path {...style} d={wirePath(points)} />
      ) : (
        <polyline {...style} points={points.map(({ x, y }) => `${x},${y}`).join(' ')} />
      )}
      {target && <TraceTarget target={target} zoom={zoom} />}
      {start && end && length > 0 && (
        <SceneText
          x={(start.x + end.x) / 2}
          y={(start.y + end.y) / 2 - 8 / zoom}
          textAnchor="middle"
          fontSize={12 / zoom}
          fill="var(--ink)"
          stroke="var(--halo)"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          paintOrder="stroke"
        >
          {connectionsEt.traceLength(length)}
        </SceneText>
      )}
    </g>
  );
}
