import type { Snapshot } from '@pcbk/contracts';
import type { EndRef, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import type { LayerSpec } from '@pcbk/ui';
import { airLineHitsEnabled, useAirLinesVisible } from './air-lines-view';

type AirLine = { id: string; a: Vec2; b: Vec2 };
type Doc = Snapshot['doc'];
const cache = new WeakMap<Doc, AirLine[]>();

function airLines(doc: Doc): AirLine[] {
  const cached = cache.get(doc);
  if (cached) return cached;
  if (doc.connections.length === 0) return [];
  const components = new Map(doc.components.map((component) => [component.id, component]));
  const junctions = new Map(doc.junctions.map((junction) => [junction.id, junction.board?.at]));
  const pads = new Map<string, Map<string, Vec2>>();

  function endpoint(end: EndRef): Vec2 | undefined {
    if ('junction' in end) return junctions.get(end.junction);
    const { c, p } = end.pin;
    let positions = pads.get(c);
    if (!positions) {
      positions = new Map();
      const component = components.get(c);
      if (component?.board) {
        for (const { pinId, at } of boardPads(
          component.board,
          component.pins.map((pin) => pin.id),
          doc.scale.pxPerMm,
        )) {
          if (!positions.has(pinId)) positions.set(pinId, at);
        }
      }
      pads.set(c, positions);
    }
    return positions.get(p);
  }

  const lines: AirLine[] = [];
  for (const connection of doc.connections) {
    if (connection.board) continue;
    const a = endpoint(connection.a);
    const b = endpoint(connection.b);
    if (a && b) lines.push({ id: connection.id, a, b });
  }
  cache.set(doc, lines);
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

export const junctionsLayer: LayerSpec = {
  id: 'connections.junctions',
  z: 45,
  render: ({ snapshot }) => (
    <g data-layer="connections.junctions" pointerEvents="none" aria-hidden="true">
      {snapshot.doc.junctions.map(({ id, board }) =>
        board ? (
          // A round cap on a zero-length stroke keeps the dot five screen pixels wide.
          <path
            key={id}
            d={`M ${board.at.x} ${board.at.y} h 0`}
            stroke={board.layer === 'top' ? 'var(--top)' : 'var(--bottom)'}
            strokeLinecap="round"
            strokeWidth={5}
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
    </g>
  ),
  hits: ({ doc }) =>
    doc.junctions.flatMap(({ id, board }) =>
      board
        ? [{ id, kind: 'junction', shape: { type: 'point', at: board.at, r: 0 }, priority: 3 }]
        : [],
    ),
};
