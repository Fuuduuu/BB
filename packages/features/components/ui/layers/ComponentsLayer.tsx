import { bodyOutline } from '@pcbk/domain/geometry';
import { useSessionStore } from '@pcbk/ui';
import type { LayerSpec, TranslatePreviewData } from '@pcbk/ui';
import type { PlacePreviewData } from '../PlaceTool';
import { PLACE_TOOL_ID } from '../place-store';
import { ComponentShape } from './ComponentShape';
import type { ComponentLayerKind } from './ComponentShape';
import { LABEL_DRAG_OWNER } from './hits';

type ComponentsLayerProps = Parameters<LayerSpec['render']>[0] & { kind: ComponentLayerKind };
type LabelPreview = { id: string; dx: number; dy: number };

function PlacementOutline({ data, pxPerMm }: { data: PlacePreviewData; pxPerMm: number }) {
  const outline = bodyOutline(
    { ...data, rotationDeg: 0, side: 'top', scaleX: 1, scaleY: 1, customPads: {} },
    pxPerMm,
  );
  if (outline.length === 0) return null;
  return (
    <polygon
      points={outline.map(({ x, y }) => `${x},${y}`).join(' ')}
      fill="none"
      stroke="var(--sel)"
      strokeWidth={1.4}
      strokeDasharray="4 3"
      vectorEffect="non-scaling-stroke"
    />
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

  return (
    <g data-layer={`components.${kind}`} pointerEvents="none">
      {snapshot.doc.components.map((component) => {
        if (!component.board) return null;
        const movement = translated.has(component.id) ? translation : null;
        const labelMovement = labelPreview?.id === component.id ? labelPreview : null;
        return (
          <ComponentShape
            key={component.id}
            kind={kind}
            component={
              component as typeof component & { board: NonNullable<typeof component.board> }
            }
            pxPerMm={snapshot.doc.scale.pxPerMm}
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
        <PlacementOutline data={placePreview} pxPerMm={snapshot.doc.scale.pxPerMm} />
      )}
    </g>
  );
}
