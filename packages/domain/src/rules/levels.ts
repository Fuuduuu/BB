import type { BoardDoc } from '../model/board';
import type { MeasuredPin } from '../model/primitives';
import { endKey, pinKey } from './nets';

export type ConnectionLevel = {
  level: 'measured' | 'visual' | 'assumed';
  noContinuity?: true;
};

type Evidence = { start: string; end: string; beep: boolean; time: number };
type Neighbor = { id: string; to: string; junction: boolean };
type Previous = { id: string; from: string };

function latestEvidence(doc: BoardDoc): Map<string, Evidence> {
  const pinUids = new Map(
    doc.components.map(({ id, pins }) => [id, new Map(pins.map((pin) => [pin.id, pin.uid]))]),
  );
  const isActive = ({ c, p, uid }: MeasuredPin) => pinUids.get(c)?.get(p) === uid;
  const evidence = new Map<string, Evidence>();
  for (const { mode, at, ref, beep, staleByRepairId, takenAt } of doc.measurements) {
    if (mode !== 'continuity' || !ref || beep === undefined || staleByRepairId !== undefined) {
      continue;
    }
    if (!isActive(at) || !isActive(ref)) continue;
    const pair: [string, string] = [pinKey(at), pinKey(ref)];
    const [start, end] = pair.sort();
    if (start === end) continue;
    const key = JSON.stringify(pair);
    const time = Date.parse(takenAt);
    const prior = evidence.get(key);
    if (!Number.isFinite(time) || (prior && time < prior.time)) continue;
    evidence.set(key, { start, end, beep, time });
  }
  return evidence;
}

function adjacency(doc: BoardDoc): Map<string, Neighbor[]> {
  const neighbors = new Map<string, Neighbor[]>();
  const junctions = new Set(doc.junctions.map(({ id }) => id));

  function add(from: string, neighbor: Neighbor) {
    const edges = neighbors.get(from);
    if (edges) edges.push(neighbor);
    else neighbors.set(from, [neighbor]);
  }

  for (const { id, a, b } of doc.connections) {
    const aKey = endKey(a);
    const bKey = endKey(b);
    add(aKey, { id, to: bKey, junction: 'junction' in b && junctions.has(b.junction) });
    add(bKey, { id, to: aKey, junction: 'junction' in a && junctions.has(a.junction) });
  }
  for (const edges of neighbors.values()) {
    if (edges.length > 1) edges.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  return neighbors;
}

function shortestPath(neighbors: Map<string, Neighbor[]>, start: string, end: string): string[] {
  const queue = [start];
  const previous = new Map<string, Previous>();
  for (let index = 0; index < queue.length; index++) {
    const from = queue[index]!;
    for (const { id, to, junction } of neighbors.get(from) ?? []) {
      if (to === end) {
        const path = [id];
        for (let step = previous.get(from); step; step = previous.get(step.from))
          path.push(step.id);
        return path;
      }
      if (!junction || previous.has(to)) continue;
      previous.set(to, { id, from });
      queue.push(to);
    }
  }
  return [];
}

export function connectionLevels(doc: BoardDoc): Record<string, ConnectionLevel> {
  const levels = Object.fromEntries<ConnectionLevel>(
    doc.connections.map(({ id, basis }) => [id, { level: basis }]),
  );
  if (!doc.connections.length || !doc.measurements.some(({ mode }) => mode === 'continuity')) {
    return levels;
  }
  const evidence = latestEvidence(doc);
  if (!evidence.size) return levels;

  const neighbors = adjacency(doc);
  for (const { start, end, beep } of evidence.values()) {
    for (const id of shortestPath(neighbors, start, end)) {
      const level = levels[id]!;
      if (beep) level.level = 'measured';
      else level.noContinuity = true;
    }
  }
  return levels;
}
