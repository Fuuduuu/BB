import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { drawingSegmentPoints, wirePath } from '@pcbk/domain/geometry';
import { endKey } from '@pcbk/domain/rules';
import type { LayerSpec, Preview } from '@pcbk/ui';
import { memo, useMemo } from 'react';
import { airLineHitsEnabled, useAirLinesVisible } from './air-lines-view';
import { connectionPoints, drawingWidth } from './connection-geometry';
import {
  CONNECTION_PREVIEW_OWNERS,
  connectionMotion,
  JUNCTION_DRAG_OWNER,
  previewConnectionPoints,
  previewEnd,
  previewJunction,
} from './connection-preview';
import { junctionDrag } from './junction-attachment';
import { drawingMidpoint, LevelMark } from './level-mark';
import { activeLayer } from './trace-geometry';

type Doc = Snapshot['doc'];
type Connection = Doc['connections'][number];
type Drawing = NonNullable<Connection['board']>;
type AirLine = { connection: Connection; a: Vec2; b: Vec2 };
type Trace = { connection: Connection; board: Drawing; points: Vec2[] };
type Geometry = Pick<Doc, 'components' | 'junctions'> & {
  pxPerMm: number;
  airLines: AirLine[];
  traces: Trace[];
};
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

const geometryCache = new WeakMap<Doc['connections'], Geometry>();
const incidentCache = new WeakMap<Doc, Map<string, Incident>>();

function connectionGeometry(doc: Doc): Geometry {
  const { components, connections, junctions } = doc;
  const { pxPerMm } = doc.scale;
  const cached = geometryCache.get(connections);
  // A measurement changes the snapshot without changing these geometry inputs.
  if (
    cached?.components === components &&
    cached.junctions === junctions &&
    cached.pxPerMm === pxPerMm
  ) {
    return cached;
  }
  const geometry: Geometry = { components, junctions, pxPerMm, airLines: [], traces: [] };
  for (const connection of connections) {
    const points = connectionPoints(doc, connection);
    if (!points) continue;
    const { board } = connection;
    if (board) geometry.traces.push({ connection, board, points });
    else geometry.airLines.push({ connection, a: points[0]!, b: points[1]! });
  }
  geometryCache.set(connections, geometry);
  return geometry;
}

const AirLineShape = memo(function AirLineShape({
  a,
  b,
  color,
  conflict,
  measured,
  zoom,
}: Pick<AirLine, 'a' | 'b'> & RoleStyle & { measured: boolean; zoom: number }) {
  const stroke = color ?? 'var(--wire)';
  const coordinates = {
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    strokeDasharray: measured ? '2 3' : '6 4',
    vectorEffect: 'non-scaling-stroke',
  };
  return (
    <>
      {conflict && <line {...coordinates} stroke="var(--danger)" strokeWidth={3.5} />}
      <line {...coordinates} stroke={stroke} strokeWidth={1.5} />
      {measured && (
        <LevelMark at={{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }} color={stroke} zoom={zoom} />
      )}
    </>
  );
});

function AirLines({ snapshot, preview, roleColor, zoom }: RoleLayerProps & { zoom: number }) {
  const visible = useAirLinesVisible();
  const lines = useMemo(
    () =>
      visible
        ? connectionGeometry(snapshot.doc).airLines.map(({ connection, a, b }) => {
            const measured =
              snapshot.derived.connectionLevels?.[connection.id]?.level === 'measured';
            const props = {
              a,
              b,
              measured,
              zoom: measured ? zoom : 1,
              ...roleColor(snapshot, endKey(connection.a)),
            };
            return { connection, props, shape: <AirLineShape key={connection.id} {...props} /> };
          })
        : [],
    [visible, snapshot, roleColor, zoom],
  );
  if (lines.length === 0) return null;
  const motion = connectionMotion(preview, snapshot.doc);
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
    render: ({ snapshot, preview, zoom }) => (
      <AirLines snapshot={snapshot} preview={preview} roleColor={roleColor} zoom={zoom} />
    ),
    hits: ({ doc }) =>
      connectionGeometry(doc).airLines.map(({ connection, a, b }) => ({
        id: connection.id,
        kind: 'connection',
        shape: { type: 'segment', a, b, width: 6, widthUnit: 'screen' },
        priority: 1,
        enabled: airLineHitsEnabled,
      })),
  };
}

type TraceShapeProps = Pick<Trace, 'board' | 'points'> &
  RoleStyle & {
    side: ReturnType<typeof activeLayer>;
    pxPerMm: number;
    zoom: number;
    measured: boolean;
  };

const TraceShape = memo(function TraceShape({
  board,
  points,
  color,
  conflict,
  side,
  pxPerMm,
  zoom,
  measured,
}: TraceShapeProps) {
  const wire = board.kind === 'wire';
  const Shape = wire ? 'path' : 'polyline';
  const geometry = wire
    ? { d: wirePath(points) }
    : { points: points.map(({ x, y }) => `${x},${y}`).join(' ') };
  const stroke = color ?? (wire ? 'var(--wire)' : `var(--${board.layer})`);
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
      <Shape {...geometry} {...style} stroke={stroke} />
      {measured && (
        <LevelMark
          at={drawingMidpoint(points, wire, zoom)}
          color={stroke}
          zoom={zoom}
          opacity={style.opacity}
        />
      )}
    </>
  );
});

function TraceDrawings({ snapshot, preview, roleColor, zoom }: RoleLayerProps & { zoom: number }) {
  const items = useMemo(() => {
    const { doc } = snapshot;
    const side = activeLayer(doc);
    return connectionGeometry(doc).traces.map(({ connection, board, points }) => {
      const props = {
        board,
        points,
        side,
        pxPerMm: doc.scale.pxPerMm,
        zoom,
        measured: snapshot.derived.connectionLevels?.[connection.id]?.level === 'measured',
        ...roleColor(snapshot, endKey(connection.a)),
      };
      return { connection, props, shape: <TraceShape key={connection.id} {...props} /> };
    });
  }, [snapshot, roleColor, zoom]);
  if (items.length === 0) return null;
  const motion = connectionMotion(preview, snapshot.doc);
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
      connectionGeometry(doc).traces.flatMap(({ connection, board, points }) => {
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
  previewOwners: [JUNCTION_DRAG_OWNER],
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
