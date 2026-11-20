import { SceneText } from '@pcbk/ui';
import { wirePath } from './connection-geometry';
import { connectionsEt } from './i18n/et';
import { PadHighlight } from './pad-highlight';
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

function TraceTarget({
  target,
  accepted,
  zoom,
}: {
  target: EndpointHit | DrawingHit;
  accepted: boolean;
  zoom: number;
}) {
  if ('segment' in target) {
    const { a, b, kind } = target;
    const stroke = accepted ? highlight.stroke : 'var(--danger)';
    return kind === 'wire' ? (
      <path {...highlight} stroke={stroke} d={wirePath([a, b])} />
    ) : (
      <line {...highlight} stroke={stroke} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
    );
  }
  const { outline } = target;
  if (outline.type === 'junction') {
    return <circle {...highlight} cx={outline.at.x} cy={outline.at.y} r={outline.radius} />;
  }
  return <PadHighlight pad={outline.pad} zoom={zoom} marker="data-trace-target" />;
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
      {target && <TraceTarget target={target.hit} accepted={target.accepted} zoom={zoom} />}
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
