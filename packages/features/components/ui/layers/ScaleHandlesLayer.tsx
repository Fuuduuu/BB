import type { Snapshot } from '@pcbk/contracts';
import { useSessionStore } from '@pcbk/ui';
import type { HitItem, LayerSpec, Selection, TranslatePreviewData } from '@pcbk/ui';
import {
  previewBoardScale,
  readScaleDrag,
  SCALE_DRAG_OWNER,
  SCALE_HANDLE_SIZE,
  scaleFromHandle,
  scaleHandlePositions,
} from './scale-handles';

function selectedComponentId(selection: Selection): string | undefined {
  const [item] = selection.items;
  if (selection.items.length === 1 && item?.kind === 'component') return item.id;
}

function componentWithHandles(snapshot: Snapshot, id: string | undefined) {
  const component = id === undefined ? undefined : snapshot.doc.components.find((c) => c.id === id);
  return component?.board ? { id: component.id, board: component.board } : undefined;
}

function ScaleHandles({ snapshot, zoom, preview }: Parameters<LayerSpec['render']>[0]) {
  const id = useSessionStore((state) => selectedComponentId(state.selection));
  const component = componentWithHandles(snapshot, id);
  if (!component) return null;

  const { pxPerMm } = snapshot.doc.scale;
  const drag = preview?.owner === SCALE_DRAG_OWNER ? readScaleDrag(preview.data) : null;
  const translation = preview?.owner === 'select' ? (preview.data as TranslatePreviewData) : null;
  const movement = translation?.items.some(
    (item) => item.kind === 'component' && item.id === component.id,
  )
    ? translation
    : null;
  const size = SCALE_HANDLE_SIZE / zoom;
  const board = previewBoardScale(component.board, component.id, drag, pxPerMm);
  return (
    <g data-layer="components.handles" aria-hidden="true" pointerEvents="none">
      {scaleHandlePositions(board, pxPerMm, zoom).map(({ handle, at }) => (
        <rect
          key={handle}
          data-scale-handle={handle}
          x={at.x + (movement?.dx ?? 0) - size / 2}
          y={at.y + (movement?.dy ?? 0) - size / 2}
          width={size}
          height={size}
          fill="var(--panel)"
          stroke="var(--sel)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

function scaleHandleHits(snapshot: Snapshot, zoom: number): HitItem[] {
  const component = componentWithHandles(
    snapshot,
    selectedComponentId(useSessionStore.getState().selection),
  );
  if (!component) return [];
  const { id, board } = component;
  const { pxPerMm } = snapshot.doc.scale;
  const half = SCALE_HANDLE_SIZE / (2 * zoom);
  return scaleHandlePositions(board, pxPerMm, zoom).map(({ handle, at }) => ({
    kind: 'component-scale-handle',
    id: `${id}:${handle}`,
    componentId: id,
    shape: { type: 'rect', at, half: { x: half, y: half }, angleDeg: 0 },
    priority: 3,
    target: { kind: 'component', id },
    drag: {
      owner: SCALE_DRAG_OWNER,
      commit(delta, api) {
        api.execute('components.setScale', {
          id,
          ...scaleFromHandle(board, handle, delta, pxPerMm),
        });
      },
    },
  }));
}

export const SCALE_HANDLES_LAYER: LayerSpec = {
  id: 'components.handles',
  z: 90,
  previewOwners: ['select', SCALE_DRAG_OWNER],
  render: (props) => <ScaleHandles {...props} />,
  hits: scaleHandleHits,
};
