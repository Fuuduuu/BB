import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { endKey } from '@pcbk/domain/rules';
import type { LayerSpec, Preview } from '@pcbk/ui';
import { memo, useMemo } from 'react';
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
export type ConnectionRoleColor = (
  snapshot: Pick<Snapshot, 'doc' | 'derived'>,
  memberKey: string,
) => { color?: string; conflict: boolean };
type RoleStyle = ReturnType<ConnectionRoleColor>;
type RoleLayerProps = {
  snapshot: Snapshot;
  preview: Preview | null;
  roleColor: ConnectionRoleColor;
};

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

const AirLineShape = memo(function AirLineShape({
  a,
  b,
  color,
  conflict,
}: Pick<AirLine, 'a' | 'b'> & RoleStyle) {
  const coordinates = {
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    strokeDasharray: '6 4',
    vectorEffect: 'non-scaling-stroke',
  };
  return (
    <>
      {conflict && <line {...coordinates} stroke="var(--danger)" strokeWidth={3.5} />}
      <line {...coordinates} stroke={color ?? 'var(--wire)'} strokeWidth={1.5} />
    </>
  );
});

function AirLines({ snapshot, preview, roleColor }: RoleLayerProps) {
  const visible = useAirLinesVisible();
  const lines = useMemo(
    () =>
      visible
        ? airLines(snapshot.doc).map(({ connection, a, b }) => {
            const props = { a, b, ...roleColor(snapshot, endKey(connection.a)) };
            return { connection, props, shape: <AirLineShape key={connection.id} {...props} /> };
          })
        : [],
    [visible, snapshot, roleColor],
  );
  if (lines.length === 0) return null;
  const motion = connectionMotion(preview);
  return (
    <g data-layer="connections.airLines" pointerEvents="none" aria-hidden="true">
      {lines.map(({ connection, props, shape }) => {
        const a = previewEnd(props.a, connection.a, motion);
        const b = previewEnd(props.b, connection.b, motion);
        return a === props.a && b === props.b ? (
          shape
        ) : (
          <AirLineShape key={connection.id} {...props} a={a} b={b} />
        );
      })}
    </g>
  );
}

export function createAirLinesLayer(roleColor: ConnectionRoleColor): LayerSpec {
  return {
    id: 'connections.airLines',
    z: 40,
    previewOwners: CONNECTION_PREVIEW_OWNERS,
    render: ({ snapshot, preview }) => (
      <AirLines snapshot={snapshot} preview={preview} roleColor={roleColor} />
    ),
    hits: ({ doc }) =>
      airLines(doc).map(({ connection, a, b }) => ({
        id: connection.id,
        kind: 'connection',
        shape: { type: 'segment', a, b, width: 6, widthUnit: 'screen' },
        priority: 1,
        enabled: airLineHitsEnabled,
      })),
  };
}

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

type TraceShapeProps = Pick<Trace, 'board' | 'points'> &
  RoleStyle & { side: ReturnType<typeof activeLayer>; pxPerMm: number; zoom: number };

const TraceShape = memo(function TraceShape({
  board,
  points,
  color,
  conflict,
  side,
  pxPerMm,
  zoom,
}: TraceShapeProps) {
  const wire = board.kind === 'wire';
  const Shape = wire ? 'path' : 'polyline';
  const geometry = wire
    ? { d: wirePath(points) }
    : { points: points.map(({ x, y }) => `${x},${y}`).join(' ') };
  const fallback = wire ? 'var(--wire)' : `var(--${board.layer})`;
  const style = {
    fill: 'none',
    strokeWidth: drawingWidth(board.widthMm, pxPerMm, zoom),
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    opacity: wire || side === board.layer ? 1 : 0.3,
  };
  return (
    <>
      {conflict && (
        <Shape
          {...geometry}
          {...style}
          stroke="var(--danger)"
          strokeWidth={style.strokeWidth + 2 / zoom}
        />
      )}
      <Shape {...geometry} {...style} stroke={color ?? fallback} />
    </>
  );
});

function TraceDrawings({ snapshot, preview, roleColor, zoom }: RoleLayerProps & { zoom: number }) {
  const items = useMemo(() => {
    const { doc } = snapshot;
    const side = activeLayer(doc);
    return traces(doc).map(({ connection, board, points }) => {
      const props = {
        board,
        points,
        side,
        pxPerMm: doc.scale.pxPerMm,
        zoom,
        ...roleColor(snapshot, endKey(connection.a)),
      };
      return { connection, props, shape: <TraceShape key={connection.id} {...props} /> };
    });
  }, [snapshot, roleColor, zoom]);
  if (items.length === 0) return null;
  const motion = connectionMotion(preview);
  return (
    <g data-layer="connections.traces" pointerEvents="none" aria-hidden="true">
      {items.map(({ connection, props, shape }) => {
        const points = previewConnectionPoints(props.points, connection, motion);
        return points === props.points ? (
          shape
        ) : (
          <TraceShape key={connection.id} {...props} points={points} />
        );
      })}
    </g>
  );
}

export function createTracesLayer(roleColor: ConnectionRoleColor): LayerSpec {
  return {
    id: 'connections.traces',
    z: 38,
    previewOwners: CONNECTION_PREVIEW_OWNERS,
    render: ({ snapshot, preview, zoom }) => (
      <TraceDrawings snapshot={snapshot} preview={preview} roleColor={roleColor} zoom={zoom} />
    ),
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
}

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

const JunctionDot = memo(function JunctionDot({
  at,
  radius,
  color,
  open,
  zoom,
}: {
  at: Vec2;
  radius: number;
  color: string;
  open: boolean;
  zoom: number;
}) {
  return (
    <circle
      cx={at.x}
      cy={at.y}
      r={radius}
      fill={open ? 'none' : color}
      stroke={open ? color : undefined}
      strokeWidth={open ? 1.4 / zoom : undefined}
    />
  );
});

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
          const color = board.layer === 'top' ? 'var(--top)' : 'var(--bottom)';
          return (
            <JunctionDot
              key={id}
              at={previewJunction(board.at, id, motion)}
              radius={junctionRadius(info, doc.scale.pxPerMm, zoom)}
              color={color}
              open={info?.count === 1 && info.drawnWidth > 0}
              zoom={zoom}
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
