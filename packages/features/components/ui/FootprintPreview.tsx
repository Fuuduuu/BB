import type { FootprintGeom } from '@pcbk/domain/footprints';
import { placementEt } from './i18n/et';

function previewViewBox({ pads, body }: FootprintGeom): string {
  const bounds = pads.map(({ x, y, w, h }) => ({
    minX: x - w / 2,
    maxX: x + w / 2,
    minY: y - h / 2,
    maxY: y + h / 2,
  }));
  if (body.w > 0 && body.h > 0) {
    bounds.push({ minX: -body.w / 2, maxX: body.w / 2, minY: -body.h / 2, maxY: body.h / 2 });
  }
  const minX = bounds.length ? Math.min(...bounds.map((box) => box.minX)) : 0;
  const maxX = bounds.length ? Math.max(...bounds.map((box) => box.maxX)) : 0;
  const minY = bounds.length ? Math.min(...bounds.map((box) => box.minY)) : 0;
  const maxY = bounds.length ? Math.max(...bounds.map((box) => box.maxY)) : 0;
  const width = maxX - minX;
  const height = maxY - minY;
  const paddingX = Math.max(width * 0.1, 0.5);
  const paddingY = Math.max(height * 0.1, 0.5);
  return `${minX - paddingX} ${minY - paddingY} ${width + 2 * paddingX} ${height + 2 * paddingY}`;
}

export function FootprintPreview({
  name,
  geometry,
}: {
  name: string;
  geometry: FootprintGeom | undefined;
}) {
  const { body, pads } = geometry ?? { body: { w: 0, h: 0 }, pads: [] };
  return (
    <div className="pcbk-library__preview">
      {geometry ? (
        <svg
          width={120}
          height={72}
          viewBox={previewViewBox(geometry)}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={placementEt.library.preview(name, pads.length)}
        >
          {body.w > 0 && body.h > 0 && (
            <rect
              x={-body.w / 2}
              y={-body.h / 2}
              width={body.w}
              height={body.h}
              fill="var(--body-fill)"
              stroke="var(--body)"
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {pads.map((pad) => {
            const style = {
              'data-pad': pad.id,
              fill: 'none',
              stroke: 'var(--ink-3)',
              strokeWidth: 1.2,
              vectorEffect: 'non-scaling-stroke',
            };
            return pad.shape === 'circle' ? (
              <circle key={pad.id} cx={pad.x} cy={pad.y} r={pad.w / 2} {...style} />
            ) : (
              <rect
                key={pad.id}
                x={pad.x - pad.w / 2}
                y={pad.y - pad.h / 2}
                width={pad.w}
                height={pad.h}
                rx={pad.shape === 'oval' ? Math.min(pad.w, pad.h) / 2 : undefined}
                {...style}
              />
            );
          })}
          {body.w > 0 && body.h > 0 && body.pin1 && (
            <circle
              data-pin1="true"
              cx={body.pin1.x}
              cy={body.pin1.y}
              r={0.25}
              fill="var(--body)"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      ) : (
        <span>{placementEt.library.previewInvalid}</span>
      )}
    </div>
  );
}
