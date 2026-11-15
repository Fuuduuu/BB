import { useMemo } from 'react';
import { boardPads } from '@pcbk/domain/geometry';
import { formatReading } from '@pcbk/domain/measure/reading';
import {
  monoLabelHalf,
  SceneText,
  sceneToScreenVector,
  useLabelObstacles,
  useSceneTransform,
} from '@pcbk/ui';
import type { LabelObstacle, LayerSpec, TranslatePreviewData } from '@pcbk/ui';
import { placeReadingLabel } from './reading-placement';

function ReadingLabels({ snapshot, zoom, preview }: Parameters<LayerSpec['render']>[0]) {
  const transform = useSceneTransform();
  const obstacles = useLabelObstacles();
  const { pxPerMm } = snapshot.doc.scale;
  const textSize = 1.2 * pxPerMm;
  const showText = textSize * zoom >= 8;
  const textInset = monoLabelHalf('', 0, zoom).x;
  // Committed layout ignores gesture previews: every label retains its chosen pin-relative offset.
  const labels = useMemo(() => {
    const placed: LabelObstacle[] = [];
    return snapshot.doc.components.flatMap(({ id, board, pins }) => {
      if (!board) return [];
      const pads = boardPads(
        board,
        pins.map((pin) => pin.id),
        pxPerMm,
      );
      return pins.flatMap(({ id: pinId, uid }) => {
        const reading = snapshot.derived.pinReadings[uid];
        if (!reading) return [];
        const text = formatReading(reading, reading.mode);
        return pads
          .filter((pad) => pad.pinId === pinId)
          .map(({ at, radiusPx }, index) => {
            const radius = Math.max(radiusPx, 5 / zoom) + 2 / zoom;
            const isLeft =
              sceneToScreenVector(transform, {
                x: at.x - board.center.x,
                y: at.y - board.center.y,
              }).x < 0;
            const placement = placeReadingLabel({
              at,
              half: monoLabelHalf(text, textSize, zoom),
              textSize,
              radius,
              labelOffset: radius + 2 / zoom,
              isLeft,
              obstacles,
              placed,
              transform,
            });
            if (showText) placed.push(placement.box);
            return { key: `${id}:${pinId}:${index}`, componentId: id, at, radius, text, placement };
          });
      });
    });
  }, [snapshot, zoom, transform, obstacles, pxPerMm, textSize, showText]);
  const translation = preview?.owner === 'select' ? (preview.data as TranslatePreviewData) : null;
  const translated = new Set(
    translation?.items.filter(({ kind }) => kind === 'component').map(({ id }) => id),
  );

  return (
    <g data-layer="measurements.readings" pointerEvents="none">
      {labels.map(({ key, componentId, at, radius, text, placement }) => {
        const offset = translated.has(componentId) ? translation : null;
        const dx = offset?.dx ?? 0;
        const dy = offset?.dy ?? 0;
        return (
          <g key={key}>
            <circle
              cx={at.x + dx}
              cy={at.y + dy}
              r={radius}
              fill="none"
              stroke="var(--ink-2)"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
            {showText && (
              <>
                {placement.leader && (
                  <line
                    x1={placement.leader.start.x + dx}
                    y1={placement.leader.start.y + dy}
                    x2={placement.leader.end.x + dx}
                    y2={placement.leader.end.y + dy}
                    stroke="var(--ink-2)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <SceneText
                  x={at.x + dx}
                  y={at.y + dy}
                  dx={
                    placement.offset.x + (placement.textAnchor === 'end' ? -textInset : textInset)
                  }
                  dy={placement.offset.y}
                  textAnchor={placement.textAnchor}
                  dominantBaseline="central"
                  fontSize={textSize}
                  fontFamily="var(--f-mono)"
                  fill="var(--ink)"
                  stroke="var(--halo)"
                  strokeWidth={2}
                  paintOrder="stroke"
                  vectorEffect="non-scaling-stroke"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {text}
                </SceneText>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

export const READING_LABELS_LAYER: LayerSpec = {
  id: 'measurements.readings',
  z: 80,
  render: (props) => <ReadingLabels {...props} />,
};
