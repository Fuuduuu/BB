import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { endKey } from '@pcbk/domain/rules';
import {
  monoLabelHalf,
  SceneText,
  screenBoxesOverlap,
  screenToSceneVector,
  useLabelObstacles,
  useSceneTransform,
  useSessionStore,
} from '@pcbk/ui';
import type { HitItem, LabelObstacle, LayerSpec, SceneTransform } from '@pcbk/ui';
import { useLayoutEffect, useMemo } from 'react';
import { connectionPoints } from './connection-geometry';

export type ConnectionNetName = (snapshot: Snapshot, memberKey: string) => string | undefined;

const TRACE_LABEL_DRAG_OWNER = 'connections.traceLabel';
const FONT_SIZE_PX = 11;

type Label = {
  id: string;
  text: string;
  anchor: Vec2;
  fixed: boolean;
  boxes: LabelObstacle[];
};
type Placement = { label: Label; index: number; box: LabelObstacle };
type PublishedLayout = {
  snapshot: Snapshot;
  zoom: number;
  transform: SceneTransform;
  indices: Map<string, number>;
};
type CandidateCache = { zoom: number; derived: Snapshot['derived']; labels: Label[] };

function traceSegments(points: readonly Vec2[]) {
  return points
    .slice(1)
    .map((end, index) => {
      const start = points[index]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      return {
        center: { x: start.x + dx / 2, y: start.y + dy / 2 },
        length: Math.hypot(dx, dy),
        dx,
        dy,
      };
    })
    .filter(({ length }) => length > 0)
    .sort((a, b) => b.length - a.length);
}

function labelCandidates(snapshot: Snapshot, zoom: number, netName: ConnectionNetName): Label[] {
  const labels: Label[] = [];
  for (const connection of snapshot.doc.connections) {
    const { id, a, board } = connection;
    if (!board) continue;
    const text = netName(snapshot, endKey(a));
    if (!text) continue;
    const points = connectionPoints(snapshot.doc, connection);
    if (!points) continue;
    const segments = traceSegments(points);
    const longest = segments[0];
    const half = monoLabelHalf(text, FONT_SIZE_PX / zoom, zoom);
    if (!longest || longest.length < 2 * half.x) continue;
    const anchor = longest.center;
    const box = (center: Vec2): LabelObstacle => ({ owner: TRACE_LABEL_DRAG_OWNER, center, half });
    const offset = board.labelOffset;
    if (offset) {
      labels.push({
        id,
        text,
        anchor,
        fixed: true,
        boxes: [box({ x: anchor.x + offset.x, y: anchor.y + offset.y })],
      });
      continue;
    }

    const clearance = 4 / zoom + half.y;
    const boxes = segments.flatMap(({ center, dx, dy, length }) => {
      const x = (dy / length) * clearance;
      const y = (-dx / length) * clearance;
      return [box({ x: center.x + x, y: center.y + y }), box({ x: center.x - x, y: center.y - y })];
    });
    labels.push({ id, text, anchor, fixed: false, boxes });
  }
  return labels;
}

function placeLabels(
  labels: readonly Label[],
  obstacles: readonly LabelObstacle[],
  transform: SceneTransform,
): Placement[] {
  // Reserve manual positions first, including labels later in document order.
  const occupied = [...obstacles, ...labels.flatMap(({ fixed, boxes }) => (fixed ? boxes : []))];
  const placed: Placement[] = [];
  for (const label of labels) {
    const index = label.fixed
      ? 0
      : label.boxes.findIndex((box) =>
          occupied.every((other) => !screenBoxesOverlap(box, other, transform)),
        );
    const box = label.boxes[index];
    if (!box) continue;
    placed.push({ label, index, box });
    if (!label.fixed) occupied.push(box);
  }
  return placed;
}

type LabelLayerProps = Parameters<LayerSpec['render']>[0] & {
  candidates(snapshot: Snapshot, zoom: number): Label[];
  publish(layout: PublishedLayout): () => void;
};

function TraceLabels({ snapshot, preview, zoom, candidates, publish }: LabelLayerProps) {
  const transform = useSceneTransform();
  const obstacles = useLabelObstacles();
  const labels = candidates(snapshot, zoom);
  const placed = useMemo(
    () => placeLabels(labels, obstacles, transform),
    [labels, obstacles, transform],
  );
  useLayoutEffect(
    () =>
      publish({
        snapshot,
        zoom,
        transform,
        indices: new Map(placed.map(({ label, index }) => [label.id, index])),
      }),
    [snapshot, publish, zoom, transform, placed],
  );
  if (placed.length === 0) return null;
  const drag =
    preview?.owner === TRACE_LABEL_DRAG_OWNER
      ? (preview.data as { id: string; dx: number; dy: number })
      : undefined;

  return (
    <g data-layer="connections.traceLabels" aria-hidden="true" pointerEvents="none">
      {placed.map(({ label, box }) => {
        const movement = drag?.id === label.id ? drag : undefined;
        return (
          <SceneText
            key={label.id}
            data-trace-label={label.id}
            x={box.center.x + (movement?.dx ?? 0)}
            y={box.center.y + (movement?.dy ?? 0)}
            fontSize={FONT_SIZE_PX / zoom}
            fontFamily="var(--f-mono)"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--ink)"
            stroke="var(--halo)"
            strokeWidth={2}
            paintOrder="stroke"
            vectorEffect="non-scaling-stroke"
          >
            {label.text}
          </SceneText>
        );
      })}
    </g>
  );
}

export function createTraceLabelsLayer(netName: ConnectionNetName): LayerSpec {
  const cache = new WeakMap<Snapshot['doc'], CandidateCache>();
  let published: PublishedLayout | undefined;

  function candidates(snapshot: Snapshot, zoom: number) {
    const cached = cache.get(snapshot.doc);
    if (cached?.zoom === zoom && cached.derived === snapshot.derived) return cached.labels;
    const labels = labelCandidates(snapshot, zoom, netName);
    cache.set(snapshot.doc, { zoom, derived: snapshot.derived, labels });
    return labels;
  }

  function publish(layout: PublishedLayout) {
    published = layout;
    return () => {
      if (published === layout) published = undefined;
    };
  }

  return {
    id: 'connections.traceLabels',
    z: 62,
    previewOwners: [TRACE_LABEL_DRAG_OWNER],
    render: (props) => <TraceLabels {...props} candidates={candidates} publish={publish} />,
    hits(snapshot, zoom, transform) {
      const axis = screenToSceneVector(transform, { x: 1, y: 0 });
      const angleDeg = (Math.atan2(axis.y, axis.x) * 180) / Math.PI;
      // Index every possible box statically, then enable only the box chosen at render.
      return candidates(snapshot, zoom).flatMap(({ id, anchor, boxes }) =>
        boxes.map(({ center, half }, index): HitItem => ({
          kind: 'connection-label',
          id,
          target: { kind: 'connection', id },
          priority: 2,
          shape: { type: 'rect', at: center, half, angleDeg },
          enabled: () =>
            published?.snapshot.doc === snapshot.doc &&
            published.snapshot.sessionId === snapshot.sessionId &&
            published.zoom === zoom &&
            published.transform === transform &&
            published.indices.get(id) === index &&
            useSessionStore.getState().toolId === 'select',
          drag: {
            owner: TRACE_LABEL_DRAG_OWNER,
            commit(delta, api) {
              api.execute('connections.setLabelOffset', {
                id,
                offset: { x: center.x + delta.x - anchor.x, y: center.y + delta.y - anchor.y },
              });
            },
          },
        })),
      );
    },
  };
}
