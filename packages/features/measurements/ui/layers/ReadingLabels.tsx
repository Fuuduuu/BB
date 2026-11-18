import { memo, useMemo } from 'react';
import type { Vec2 } from '@pcbk/domain';
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
import type { ReadingPlacement } from './reading-placement';

const SCALE_DRAG_OWNER = 'components.scale';

interface ReadingLayout {
  key: string;
  componentId: string;
  at: Vec2;
  radius: number;
  text: string;
  placement: ReadingPlacement;
  showText: boolean;
  textSize: number;
  textInset: number;
}

const ReadingLabel = memo(function ReadingLabel({
  layout,
  dx,
  dy,
}: {
  layout: ReadingLayout;
  dx: number;
  dy: number;
}) {
  const { at, radius, text, placement, showText, textSize, textInset } = layout;
  return (
    <g>
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
            dx={placement.offset.x + (placement.textAnchor === 'end' ? -textInset : textInset)}
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
});

function ReadingLabels({ snapshot, zoom, preview }: Parameters<LayerSpec['render']>[0]) {
  const transform = useSceneTransform();
  const obstacles = useLabelObstacles();
  const { pxPerMm } = snapshot.doc.scale;
  const textSize = 1.2 * pxPerMm;
  const showText = textSize * zoom >= 8;
  const textInset = monoLabelHalf('', 0, zoom).x;
  // Committed layout ignores gesture previews: every label retains its chosen pin-relative offset.
  const labels = useMemo<ReadingLayout[]>(() => {
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
            return {
              key: `${id}:${pinId}:${index}`,
              componentId: id,
              at,
              radius,
              text,
              placement,
              showText,
              textSize,
              textInset,
            };
          });
      });
    });
  }, [snapshot, zoom, transform, obstacles, pxPerMm, textSize, showText, textInset]);
  const stationaryLabels = useMemo(
    () => labels.map((layout) => <ReadingLabel key={layout.key} layout={layout} dx={0} dy={0} />),
    [labels],
  );
  const translation = preview?.owner === 'select' ? (preview.data as TranslatePreviewData) : null;
  // SelectTool puts the hit ID (`componentId:handle`) into the scale preview.
  const scaleHitId =
    preview?.owner === SCALE_DRAG_OWNER ? (preview.data as { id: string }).id : undefined;
  const hiddenId = scaleHitId?.slice(0, scaleHitId.lastIndexOf(':'));
  const translated = new Set(
    translation?.items.filter(({ kind }) => kind === 'component').map(({ id }) => id),
  );

  return (
    <g data-layer="measurements.readings" pointerEvents="none">
      {translation || hiddenId
        ? labels.map((layout, index) => {
            if (layout.componentId === hiddenId) return null;
            return translation && translated.has(layout.componentId) ? (
              <ReadingLabel
                key={layout.key}
                layout={layout}
                dx={translation.dx}
                dy={translation.dy}
              />
            ) : (
              stationaryLabels[index]
            );
          })
        : stationaryLabels}
    </g>
  );
}

export const READING_LABELS_LAYER: LayerSpec = {
  id: 'measurements.readings',
  z: 80,
  previewOwners: ['select', SCALE_DRAG_OWNER],
  render: (props) => <ReadingLabels {...props} />,
};
