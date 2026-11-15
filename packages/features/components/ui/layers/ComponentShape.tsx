import { memo } from 'react';
import type { Snapshot } from '@pcbk/contracts';
import type { BoardPlacement } from '@pcbk/domain';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { boardPads, bodyOutline, padToBoard } from '@pcbk/domain/geometry';
import { SceneText, useSceneTransform } from '@pcbk/ui';
import { componentLabelBox, isComponentLabelVisible } from './hits';
import { PinLabels, PinMarker } from './PinMarker';

export type ComponentLayerKind = 'bodies' | 'pins' | 'labels';
type PlacedComponent = Snapshot['doc']['components'][number] & { readonly board: BoardPlacement };

type ComponentShapeProps = {
  kind: ComponentLayerKind;
  component: PlacedComponent;
  pxPerMm: number;
  zoom: number;
  selected: boolean;
  selectedPinId: string | null;
  dx: number;
  dy: number;
  labelDx: number;
  labelDy: number;
};

function translation(dx: number, dy: number): string | undefined {
  return dx || dy ? `translate(${dx} ${dy})` : undefined;
}

function Body({
  board,
  pxPerMm,
  zoom,
  selected,
}: {
  board: BoardPlacement;
  pxPerMm: number;
  zoom: number;
  selected: boolean;
}) {
  const outline = bodyOutline(board, pxPerMm);
  if (outline.length === 0) return null;
  const pin1 = footprintGeometry(board.footprint, board.params)?.body.pin1;
  const pin1At = pin1 && padToBoard(board, pin1, pxPerMm);
  const geometry = {
    points: outline.map(({ x, y }) => `${x},${y}`).join(' '),
    strokeDasharray: board.side === 'bottom' ? '4 3' : undefined,
    vectorEffect: 'non-scaling-stroke',
  };
  return (
    <>
      <polygon {...geometry} fill="var(--body-fill)" stroke="var(--halo)" strokeWidth={3.6} />
      <polygon
        {...geometry}
        fill="none"
        stroke={selected ? 'var(--sel)' : 'var(--body)'}
        strokeWidth={1.4}
      />
      {pin1At && (
        <circle
          cx={pin1At.x}
          cy={pin1At.y}
          r={Math.max(0.25 * pxPerMm, 2 / zoom)}
          fill="var(--body)"
          stroke="var(--halo)"
          strokeWidth={3.6}
          paintOrder="stroke"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </>
  );
}

function Labels({
  component,
  pxPerMm,
  zoom,
  dx,
  dy,
}: {
  component: PlacedComponent;
  pxPerMm: number;
  zoom: number;
  dx: number;
  dy: number;
}) {
  const transform = useSceneTransform();
  const { at, textSize, valueAt } = componentLabelBox(component, pxPerMm, zoom, transform);
  if (!isComponentLabelVisible(textSize, zoom)) return null;
  const textProps = {
    x: at.x,
    fontSize: textSize,
    fontFamily: 'var(--f-mono)',
    textAnchor: 'middle' as const,
    dominantBaseline: 'central' as const,
    fill: 'var(--ink)',
    stroke: 'var(--halo)',
    strokeWidth: 2,
    paintOrder: 'stroke',
    vectorEffect: 'non-scaling-stroke',
    style: { fontVariantNumeric: 'tabular-nums' },
  };
  return (
    <g transform={translation(dx, dy)}>
      <SceneText {...textProps} y={at.y}>
        {component.dnp ? (
          <tspan textDecoration="line-through">{component.ref}</tspan>
        ) : (
          component.ref
        )}
        {!component.identified && <tspan fontSize={textSize * 0.75}> ?</tspan>}
      </SceneText>
      {component.value && (
        <SceneText {...textProps} x={valueAt.x} y={valueAt.y}>
          {component.value}
        </SceneText>
      )}
    </g>
  );
}

export const ComponentShape = memo(function ComponentShape({
  kind,
  component,
  pxPerMm,
  zoom,
  selected,
  selectedPinId,
  dx,
  dy,
  labelDx,
  labelDy,
}: ComponentShapeProps) {
  const transform = translation(dx, dy);
  if (kind === 'bodies') {
    return (
      <g
        data-component={component.id}
        transform={transform}
        opacity={component.dnp ? 0.4 : undefined}
      >
        <Body board={component.board} pxPerMm={pxPerMm} zoom={zoom} selected={selected} />
      </g>
    );
  }

  const pins = new Map(component.pins.map((pin) => [pin.id, pin]));
  const pads = boardPads(component.board, [...pins.keys()], pxPerMm);
  return (
    <g data-component={component.id} transform={transform}>
      {pads.map(({ pinId, at, halfPx, angleDeg, shape }, index) => {
        const pin = pins.get(pinId)!;
        const props = {
          pin,
          x: at.x,
          y: at.y,
          halfPx: { x: Math.max(halfPx.x, 2.5 / zoom), y: Math.max(halfPx.y, 2.5 / zoom) },
          angleDeg,
          shape,
          zoom,
        };
        const key = `${pin.uid}:${index}`;
        return kind === 'pins' ? (
          <PinMarker key={key} {...props} selected={pinId === selectedPinId} />
        ) : (
          <PinLabels key={key} {...props} />
        );
      })}
      {kind === 'labels' && (
        <Labels component={component} pxPerMm={pxPerMm} zoom={zoom} dx={labelDx} dy={labelDy} />
      )}
    </g>
  );
});
