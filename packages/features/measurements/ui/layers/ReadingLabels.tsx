import { boardPads } from '@pcbk/domain/geometry';
import { formatReading } from '@pcbk/domain/measure/reading';
import { SceneText, sceneToScreenVector, useSceneTransform } from '@pcbk/ui';
import type { LayerSpec, TranslatePreviewData } from '@pcbk/ui';

function ReadingLabels({ snapshot, zoom, preview }: Parameters<LayerSpec['render']>[0]) {
  const transform = useSceneTransform();
  const readings = new Map(Object.entries(snapshot.derived.pinReadings));
  const { pxPerMm } = snapshot.doc.scale;
  const textSize = 1.2 * pxPerMm;
  const showText = textSize * zoom >= 8;
  const translation = preview?.owner === 'select' ? (preview.data as TranslatePreviewData) : null;
  const translated = new Set(
    translation?.items.filter(({ kind }) => kind === 'component').map(({ id }) => id),
  );

  return (
    <g data-layer="measurements.readings" pointerEvents="none">
      {readings.size > 0 &&
        snapshot.doc.components.map(({ id, board, pins }) => {
          if (!board) return null;
          const labels = new Map(
            pins.flatMap(({ id, uid }) => {
              const reading = readings.get(uid);
              return reading ? [[id, formatReading(reading, reading.mode)] as const] : [];
            }),
          );
          if (labels.size === 0) return null;

          const offset = translated.has(id) ? translation : null;
          const pads = boardPads(board, [...labels.keys()], pxPerMm);
          return pads.map(({ pinId, at, radiusPx }, index) => {
            const x = at.x + (offset?.dx ?? 0);
            const y = at.y + (offset?.dy ?? 0);
            const isLeft =
              sceneToScreenVector(transform, {
                x: at.x - board.center.x,
                y: at.y - board.center.y,
              }).x < 0;
            const radius = Math.max(radiusPx, 5 / zoom) + 2 / zoom;
            const labelOffset = radius + 2 / zoom;
            return (
              <g key={`${id}:${index}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill="none"
                  stroke="var(--ink-2)"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                />
                {showText && (
                  <SceneText
                    x={x}
                    y={y}
                    dx={isLeft ? -labelOffset : labelOffset}
                    dy={-labelOffset}
                    textAnchor={isLeft ? 'end' : 'start'}
                    fontSize={textSize}
                    fontFamily="var(--f-mono)"
                    fill="var(--ink)"
                    stroke="var(--halo)"
                    strokeWidth={2}
                    paintOrder="stroke"
                    vectorEffect="non-scaling-stroke"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {labels.get(pinId)}
                  </SceneText>
                )}
              </g>
            );
          });
        })}
    </g>
  );
}

export const READING_LABELS_LAYER: LayerSpec = {
  id: 'measurements.readings',
  z: 80,
  render: (props) => <ReadingLabels {...props} />,
};
