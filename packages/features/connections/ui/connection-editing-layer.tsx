import { useSessionStore } from '@pcbk/ui';
import type { HitItem, LayerSpec, Selection } from '@pcbk/ui';
import {
  connectionMotion,
  JUNCTION_DRAG_OWNER,
  previewJunction,
  previewWaypoint,
  waypointId,
  WAYPOINT_DRAG_OWNER,
} from './connection-preview';
import { junctionAttachment } from './junction-attachment';
import { PadHighlight } from './pad-highlight';

const HANDLE_SIZE = 6;

export function selectedConnectionId(selection: Selection): string | undefined {
  const connections = selection.items.filter(({ kind }) => kind === 'connection');
  return connections.length === 1 ? connections[0]?.id : undefined;
}

function WaypointHandles({ snapshot, preview, zoom }: Parameters<LayerSpec['render']>[0]) {
  const id = useSessionStore(({ selection, toolId }) =>
    toolId === 'select' ? selectedConnectionId(selection) : undefined,
  );
  const waypoints = snapshot.doc.connections.find((connection) => connection.id === id)?.board
    ?.waypoints;
  if (!id || !waypoints?.length) return null;
  const size = HANDLE_SIZE / zoom;
  const motion = connectionMotion(preview);
  return (
    <g data-layer="connections.waypoints" pointerEvents="none" aria-hidden="true">
      {waypoints.map((at, index) => {
        const key = waypointId(id, index);
        const { x, y } = previewWaypoint(at, id, index, motion);
        return (
          <rect
            key={key}
            data-waypoint-handle={key}
            x={x - size / 2}
            y={y - size / 2}
            width={size}
            height={size}
            fill="var(--panel)"
            stroke="var(--sel)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}

function AttachmentHighlight({
  snapshot: { doc },
  preview,
  zoom,
}: Parameters<LayerSpec['render']>[0]) {
  const motion = connectionMotion(preview);
  if (motion?.kind !== 'junction') return null;
  const at = doc.junctions.find(({ id }) => id === motion.id)?.board?.at;
  if (!at) return null;
  const moved = previewJunction(at, motion.id, motion);
  const target = junctionAttachment(doc, motion.id, moved, zoom);
  return target ? (
    <g pointerEvents="none" aria-hidden="true">
      <PadHighlight pad={target.pad} zoom={zoom} marker="data-junction-attachment-target" />
    </g>
  ) : null;
}

export const connectionEditingLayer: LayerSpec = {
  id: 'connections.editing',
  z: 55,
  previewOwners: [WAYPOINT_DRAG_OWNER, JUNCTION_DRAG_OWNER],
  render: (props) => (
    <>
      <WaypointHandles {...props} />
      <AttachmentHighlight {...props} />
    </>
  ),
  hits: ({ doc }, zoom) => {
    const half = HANDLE_SIZE / (2 * zoom);
    return doc.connections.flatMap(({ id, board }) =>
      (board?.waypoints ?? []).map((at, index): HitItem => ({
        kind: 'waypoint',
        id: waypointId(id, index),
        priority: 4,
        shape: { type: 'rect', at, half: { x: half, y: half }, angleDeg: 0 },
        target: { kind: 'connection', id },
        enabled() {
          const { selection, toolId } = useSessionStore.getState();
          return toolId === 'select' && selectedConnectionId(selection) === id;
        },
        drag: {
          owner: WAYPOINT_DRAG_OWNER,
          commit(delta, api) {
            const connection = api.snapshot().doc.connections.find((entry) => entry.id === id);
            const current = connection?.board?.waypoints;
            if (!current?.[index]) return;
            const waypoints = current.map((point, i) =>
              i === index ? { x: point.x + delta.x, y: point.y + delta.y } : point,
            );
            api.execute('connections.update', { id, waypoints });
          },
        },
      })),
    );
  },
};
