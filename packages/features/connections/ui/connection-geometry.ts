import type { Snapshot } from '@pcbk/contracts';
import type { EndRef, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';

type Doc = Snapshot['doc'];
type Connection = Doc['connections'][number];
const endpointCache = new WeakMap<Doc, (end: EndRef) => Vec2 | undefined>();

function endpointLookup(doc: Doc) {
  const components = new Map(doc.components.map((component) => [component.id, component]));
  const junctions = new Map(doc.junctions.map((junction) => [junction.id, junction.board?.at]));
  const pads = new Map<string, Map<string, Vec2>>();
  return (end: EndRef): Vec2 | undefined => {
    if ('junction' in end) return junctions.get(end.junction);
    const { c, p } = end.pin;
    let positions = pads.get(c);
    if (!positions) {
      positions = new Map();
      const component = components.get(c);
      if (component?.board) {
        for (const { pinId, at } of boardPads(
          component.board,
          component.pins.map(({ id }) => id),
          doc.scale.pxPerMm,
        )) {
          if (!positions.has(pinId)) positions.set(pinId, at);
        }
      }
      pads.set(c, positions);
    }
    return positions.get(p);
  };
}

export function connectionEndpoint(doc: Doc, end: EndRef): Vec2 | undefined {
  let lookup = endpointCache.get(doc);
  if (!lookup) {
    lookup = endpointLookup(doc);
    endpointCache.set(doc, lookup);
  }
  return lookup(end);
}

export function connectionPoints(
  doc: Doc,
  { a, b, board }: Pick<Connection, 'a' | 'b' | 'board'>,
): Vec2[] | undefined {
  const start = connectionEndpoint(doc, a);
  const end = connectionEndpoint(doc, b);
  return start && end ? [start, ...(board?.waypoints ?? []), end] : undefined;
}

export function drawingWidth(widthMm: number, pxPerMm: number, zoom: number): number {
  return Math.max(widthMm * pxPerMm, 1.4 / zoom);
}
