import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import type { LayerSpec, Preview } from '@pcbk/ui';
import { airLineHitsEnabled, useAirLinesVisible } from './air-lines-view';
import {
  connectionPoints,
  drawingSegmentPoints,
  drawingWidth,
  wirePath,
} from './connection-geometry';
import {
  CONNECTION_PREVIEW_OWNERS,
  connectionMotion,
  previewConnectionPoints,
  previewEnd,
  previewJunction,
} from './connection-preview';
import { junctionDrag } from './junction-attachment';
import { activeLayer } from './trace-geometry';

type Doc = Snapshot['doc'];
type Connection = Doc['connections'][number];
type Drawing = NonNullable<Connection['board']>;
type AirLine = { connection: Connection; a: Vec2; b: Vec2 };
type Trace = { connection: Connection; board: Drawing; points: Vec2[] };
type Incident = { count: number; drawnWidth: number };

const airLineCache = new WeakMap<Doc, AirLine[]>();
const traceCache = new WeakMap<Doc, Trace[]>();
const incidentCache = new WeakMap<Doc, Map<string, Incident>>();

function airLines(doc: Doc): AirLine[] {
  const cached = airLineCache.get(doc);
  if (cached) return cached;
  const lines: AirLine[] = [];
  for (const connection of doc.connections) {
    if (connection.board) continue;
    const points = connectionPoints(doc, connection);
    if (points) lines.push({ connection, a: points[0]!, b: points[1]! });
  }
  airLineCache.set(doc, lines);
  return lines;
}

function AirLines({ doc, preview }: { doc: Doc; preview: Preview | null }) {
  const visible = useAirLinesVisible();
  const lines = visible ? airLines(doc) : [];
  if (lines.length === 0) return null;
  const motion = connectionMotion(preview);
  return (
    <g data-layer="connections.airLines" pointerEvents="none" aria-hidden="true">
      {lines.map(({ connection, a, b }) => {
        const start = previewEnd(a, connection.a, motion);
        const end = previewEnd(b, connection.b, motion);
        return (
          <line
            key={connection.id}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="var(--wire)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}

export const airLinesLayer: LayerSpec = {
  id: 'connections.airLines',
  z: 40,
  previewOwners: CONNECTION_PREVIEW_OWNERS,
  render: ({ snapshot, preview }) => <AirLines doc={snapshot.doc} preview={preview} />,
  hits: ({ doc }) =>
    airLines(doc).map(({ connection, a, b }) => ({
      id: connection.id,
      kind: 'connection',
      shape: { type: 'segment', a, b, width: 6, widthUnit: 'screen' },
      priority: 1,
      enabled: airLineHitsEnabled,
    })),
};

function traces(doc: Doc): Trace[] {
  const cached = traceCache.get(doc);
  if (cached) return cached;
  const items: Trace[] = [];
  for (const connection of doc.connections) {
    if (!connection.board) continue;
    const points = connectionPoints(doc, connection);
    if (points) items.push({ connection, board: connection.board, points });
  }
  traceCache.set(doc, items);
  return items;
}

export const tracesLayer: LayerSpec = {
  id: 'connections.traces',
  z: 38,
  previewOwners: CONNECTION_PREVIEW_OWNERS,
  render({ snapshot: { doc }, preview, zoom }) {
    const items = traces(doc);
    if (!items.length) return null;
    const side = activeLayer(doc);
    const motion = connectionMotion(preview);
    return (
      <g data-layer="connections.traces" pointerEvents="none" aria-hidden="true">
        {items.map(({ connection, board, points }) => {
          const adjusted = previewConnectionPoints(points, connection, motion);
          const style = {
            fill: 'none',
            strokeWidth: drawingWidth(board.widthMm, doc.scale.pxPerMm, zoom),
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
            opacity: board.kind === 'wire' || side === board.layer ? 1 : 0.3,
          };
          return board.kind === 'wire' ? (
            <path key={connection.id} d={wirePath(adjusted)} stroke="var(--wire)" {...style} />
          ) : (
            <polyline
              key={connection.id}
              points={adjusted.map(({ x, y }) => `${x},${y}`).join(' ')}
              stroke={board.layer === 'top' ? 'var(--top)' : 'var(--bottom)'}
              {...style}
            />
          );
        })}
      </g>
    );
  },
  hits: ({ doc }, zoom) =>
    traces(doc).flatMap(({ connection, board, points }) => {
      const width = drawingWidth(board.widthMm, doc.scale.pxPerMm, zoom);
      return points.slice(1).flatMap((b, segment) => {
        const line = drawingSegmentPoints(points[segment]!, b, board.kind, zoom);
        return line.slice(1).map((point, index) => ({
          id: connection.id,
          kind: 'connection',
          shape: { type: 'segment', a: line[index]!, b: point, width },
          priority: 1,
          data: { segment },
        }));
      });
    }),
};

function junctionIncidents(doc: Doc): Map<string, Incident> {
  const cached = incidentCache.get(doc);
  if (cached) return cached;
  const incidents = new Map<string, Incident>();
  for (const { a, b, board } of doc.connections) {
    for (const end of [a, b]) {
      if (!('junction' in end)) continue;
      const info = incidents.get(end.junction) ?? { count: 0, drawnWidth: 0 };
      info.count++;
      info.drawnWidth = Math.max(info.drawnWidth, board?.widthMm ?? 0);
      incidents.set(end.junction, info);
    }
  }
  incidentCache.set(doc, incidents);
  return incidents;
}

function junctionRadius(info: Incident | undefined, pxPerMm: number, zoom: number): number {
  return Math.max(2.5 / zoom, (2.5 * (info?.drawnWidth ?? 0) * pxPerMm) / 2);
}

export const junctionsLayer: LayerSpec = {
  id: 'connections.junctions',
  z: 45,
  previewOwners: CONNECTION_PREVIEW_OWNERS,
  render({ snapshot: { doc }, preview, zoom }) {
    const incidents = junctionIncidents(doc);
    const motion = connectionMotion(preview);
    return (
      <g data-layer="connections.junctions" pointerEvents="none" aria-hidden="true">
        {doc.junctions.map(({ id, board }) => {
          if (!board) return null;
          const info = incidents.get(id);
          const open = info?.count === 1 && info.drawnWidth > 0;
          const color = board.layer === 'top' ? 'var(--top)' : 'var(--bottom)';
          const at = previewJunction(board.at, id, motion);
          return (
            <circle
              key={id}
              cx={at.x}
              cy={at.y}
              r={junctionRadius(info, doc.scale.pxPerMm, zoom)}
              fill={open ? 'none' : color}
              stroke={open ? color : undefined}
              strokeWidth={open ? 1.4 / zoom : undefined}
            />
          );
        })}
      </g>
    );
  },
  hits({ doc }, zoom) {
    const incidents = junctionIncidents(doc);
    return doc.junctions.flatMap(({ id, board }) =>
      board
        ? [
            {
              id,
              kind: 'junction',
              shape: {
                type: 'point',
                at: board.at,
                r: junctionRadius(incidents.get(id), doc.scale.pxPerMm, zoom),
              },
              priority: 3,
              drag: junctionDrag(id, zoom),
            },
          ]
        : [],
    );
  },
};
