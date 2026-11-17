import type { BoardPlacement } from '@pcbk/domain';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { boardPads, bodyOutline, padToBoard } from '@pcbk/domain/geometry';
import { useSceneTransform, useSessionStore } from '@pcbk/ui';
import type { LayerSpec, TranslatePreviewData } from '@pcbk/ui';
import type { PlacePreviewData } from '../PlaceTool';
import { placementRotation } from '../placement-rotation';
import { PLACE_TOOL_ID } from '../place-store';
import { ComponentShape } from './ComponentShape';
import type { ComponentLayerKind } from './ComponentShape';
import { LABEL_DRAG_OWNER } from './hits';
import { PadOutline } from './PinMarker';
import { previewBoardScale, readScaleDrag, SCALE_DRAG_OWNER } from './scale-handles';

type ComponentsLayerProps = Parameters<LayerSpec['render']>[0] & { kind: ComponentLayerKind };
type LabelPreview = { id: string; dx: number; dy: number };

function PlacementGhost({
  data,
  pxPerMm,
  zoom,
}: {
  data: PlacePreviewData;
  pxPerMm: number;
  zoom: number;
}) {
  const rotationDeg = placementRotation(useSceneTransform());
  const placement: BoardPlacement = {
    ...data,
    rotationDeg,
    side: 'top',
    scaleX: 1,
    scaleY: 1,
    customPads: {},
  };
  const geometry = footprintGeometry(data.footprint, data.params);
  if (!geometry) return null;
  const outline = bodyOutline(placement, pxPerMm);
  const pads = boardPads(
    placement,
    geometry.pads.map(({ id }) => id),
    pxPerMm,
  );
  const pin1At = geometry.body.pin1 && padToBoard(placement, geometry.body.pin1, pxPerMm);
  return (
    <g data-placement-ghost pointerEvents="none">
      {outline.length > 0 && (
        <polygon
          points={outline.map(({ x, y }) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="var(--sel)"
          strokeWidth={1.4}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {pads.map(({ pinId, at, halfPx, angleDeg, shape }, index) => (
        <g key={`${pinId}:${index}`} data-pad={pinId}>
          <PadOutline
            x={at.x}
            y={at.y}
            halfPx={{ x: Math.max(halfPx.x, 2.5 / zoom), y: Math.max(halfPx.y, 2.5 / zoom) }}
            angleDeg={angleDeg}
            shape={shape}
            stroke="var(--sel)"
            strokeWidth={1.4}
          />
        </g>
      ))}
      {pin1At && (
        <circle
          data-pin1
          cx={pin1At.x}
          cy={pin1At.y}
          r={Math.max(0.25 * pxPerMm, 2 / zoom)}
          fill="var(--sel)"
        />
      )}
    </g>
  );
}

export function ComponentsLayer({ kind, snapshot, zoom, preview }: ComponentsLayerProps) {
  const selection = useSessionStore((state) => state.selection);
  const selected = new Set<string>();
  const selectedPins = new Map<string, string>();
  for (const item of selection.items) {
    if (item.kind === 'component') selected.add(item.id);
    if (
      item.kind === 'pin' &&
      item.componentId !== undefined &&
      !selectedPins.has(item.componentId)
    ) {
      selectedPins.set(item.componentId, item.id);
    }
  }

  const translation = preview?.owner === 'select' ? (preview.data as TranslatePreviewData) : null;
  const translated = new Set(
    translation?.items.filter((item) => item.kind === 'component').map((item) => item.id),
  );
  const labelPreview =
    kind === 'labels' && preview?.owner === LABEL_DRAG_OWNER
      ? (preview.data as LabelPreview)
      : null;
  const placePreview =
    kind === 'bodies' && preview?.owner === PLACE_TOOL_ID
      ? (preview.data as PlacePreviewData)
      : null;
  const scaleDrag = preview?.owner === SCALE_DRAG_OWNER ? readScaleDrag(preview.data) : null;
  const { pxPerMm } = snapshot.doc.scale;

  return (
    <g data-layer={`components.${kind}`} pointerEvents="none">
      {snapshot.doc.components.map((component) => {
        if (!component.board) return null;
        const movement = translated.has(component.id) ? translation : null;
        const labelMovement = labelPreview?.id === component.id ? labelPreview : null;
        const board = previewBoardScale(component.board, component.id, scaleDrag, pxPerMm);
        return (
          <ComponentShape
            key={component.id}
            kind={kind}
            component={
              board === component.board
                ? (component as typeof component & { board: typeof board })
                : { ...component, board }
            }
            pxPerMm={pxPerMm}
            zoom={zoom}
            selected={kind === 'bodies' && selected.has(component.id)}
            selectedPinId={kind === 'pins' ? (selectedPins.get(component.id) ?? null) : null}
            dx={movement?.dx ?? 0}
            dy={movement?.dy ?? 0}
            labelDx={labelMovement?.dx ?? 0}
            labelDy={labelMovement?.dy ?? 0}
          />
        );
      })}
      {placePreview && (
        <PlacementGhost data={placePreview} pxPerMm={snapshot.doc.scale.pxPerMm} zoom={zoom} />
      )}
    </g>
  );
}
