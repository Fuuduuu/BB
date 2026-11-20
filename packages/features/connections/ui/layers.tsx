import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import type { LayerSpec } from '@pcbk/ui';
import { airLineHitsEnabled, useAirLinesVisible } from './air-lines-view';
import {
  connectionPoints,
  drawingSegmentPoints,
  drawingWidth,
  wirePath,
} from './connection-geometry';
import { activeLayer } from './trace-geometry';

type AirLine = { id: string; a: Vec2; b: Vec2 };
type Doc = Snapshot['doc'];
type Drawing = NonNullable<Doc['connections'][number]['board']>;
type Trace = { id: string; board: Drawing; points: Vec2[] };
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
    if (points) lines.push({ id: connection.id, a: points[0]!, b: points[1]! });
  }
  airLineCache.set(doc, lines);
  return lines;
}

function AirLines({ doc }: { doc: Doc }) {
  const visible = useAirLinesVisible();
  const lines = visible ? airLines(doc) : [];
  if (lines.length === 0) return null;
  return (
    <g data-layer="connections.airLines" pointerEvents="none" aria-hidden="true">
      {lines.map(({ id, a, b }) => (
        <line
          key={id}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="var(--wire)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

export const airLinesLayer: LayerSpec = {
  id: 'connections.airLines',
  z: 40,
  render: ({ snapshot }) => <AirLines doc={snapshot.doc} />,
  hits: ({ doc }) =>
    airLines(doc).map(({ id, a, b }) => ({
      id,
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
    if (points) items.push({ id: connection.id, board: connection.board, points });
  }
  traceCache.set(doc, items);
  return items;
}

export const tracesLayer: LayerSpec = {
  id: 'connections.traces',
  z: 38,
  render({ snapshot: { doc }, zoom }) {
    const items = traces(doc);
    if (!items.length) return null;
    const side = activeLayer(doc);
    return (
      <g data-layer="connections.traces" pointerEvents="none" aria-hidden="true">
        {items.map(({ id, board, points }) => {
          const style = {
            fill: 'none',
            strokeWidth: drawingWidth(board.widthMm, doc.scale.pxPerMm, zoom),
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
            opacity: side === board.layer ? 1 : 0.3,
          };
          return board.kind === 'wire' ? (
            <path key={id} d={wirePath(points)} stroke="var(--wire)" {...style} />
          ) : (
            <polyline
              key={id}
              points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
              stroke={board.layer === 'top' ? 'var(--top)' : 'var(--bottom)'}
              {...style}
            />
          );
        })}
      </g>
    );
  },
  hits: ({ doc }, zoom) =>
    traces(doc).flatMap(({ id, board, points }) => {
      const width = drawingWidth(board.widthMm, doc.scale.pxPerMm, zoom);
      return points.slice(1).flatMap((b, segment) => {
        const line = drawingSegmentPoints(points[segment]!, b, board.kind, zoom);
        return line.slice(1).map((point, index) => ({
          id,
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
  render({ snapshot: { doc }, zoom }) {
    const incidents = junctionIncidents(doc);
    return (
      <g data-layer="connections.junctions" pointerEvents="none" aria-hidden="true">
        {doc.junctions.map(({ id, board }) => {
          if (!board) return null;
          const info = incidents.get(id);
          const open = info?.count === 1 && info.drawnWidth > 0;
          const color = board.layer === 'top' ? 'var(--top)' : 'var(--bottom)';
          return (
            <circle
              key={id}
              cx={board.at.x}
              cy={board.at.y}
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
            },
          ]
        : [],
    );
  },
};
