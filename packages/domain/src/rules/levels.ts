import type { BoardDoc } from '../model/board';
import type { MeasuredPin } from '../model/primitives';
import { compareTimestamps } from './compare-timestamps';
import { endKey, pinKey } from './nets';

export type ConnectionLevel = {
  level: 'measured' | 'visual' | 'assumed';
  noContinuity?: true;
};

type Evidence = { start: string; end: string; beep: boolean; takenAt: string };
type Neighbor = { id: string; to: string; junction: boolean };
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
    const prior = evidence.get(key);
    if (!Number.isFinite(Date.parse(takenAt))) continue;
    if (prior && compareTimestamps(takenAt, prior.takenAt) < 0) continue;
    evidence.set(key, { start, end, beep, takenAt });
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

type Visit = {
  distance: number;
  via?: { id: string; from: string };
  marks: number;
};

function searchPaths(
  neighbors: Map<string, Neighbor[]>,
  root: string,
  pending: Set<string>,
): Map<string, Visit> {
  const queue = [root];
  const visits = new Map<string, Visit>([[root, { distance: 0, marks: 0 }]]);
  for (let index = 0; index < queue.length && pending.size > 0; index++) {
    const from = queue[index]!;
    const distance = visits.get(from)!.distance + 1;
    for (const { id, to, junction } of neighbors.get(from) ?? []) {
      if ((!junction && !pending.has(to)) || visits.has(to)) continue;
      visits.set(to, { via: { id, from }, distance, marks: 0 });
      if (junction) {
        queue.push(to);
      } else {
        pending.delete(to);
        if (pending.size === 0) break;
      }
    }
  }
  return visits;
}

function groupSearches(evidence: Map<string, Evidence>) {
  const startCounts = new Map<string, number>();
  const endCounts = new Map<string, number>();
  for (const { start, end } of evidence.values()) {
    startCounts.set(start, (startCounts.get(start) ?? 0) + 1);
    endCounts.set(end, (endCounts.get(end) ?? 0) + 1);
  }

  const byStart = new Map<string, Evidence[]>();
  const byEnd = new Map<string, Evidence[]>();
  for (const item of evidence.values()) {
    const forward = startCounts.get(item.start)! >= endCounts.get(item.end)!;
    const groups = forward ? byStart : byEnd;
    const root = forward ? item.start : item.end;
    const group = groups.get(root);
    if (group) group.push(item);
    else groups.set(root, [item]);
  }
  return { byStart, byEnd };
}

const measured = 1;
const noContinuity = 2;
type Mark = typeof measured | typeof noContinuity;

function markLevel(level: ConnectionLevel, mark: Mark) {
  if (mark === measured) level.level = 'measured';
  else level.noContinuity = true;
}

function markFromStartTrees(
  levels: Record<string, ConnectionLevel>,
  neighbors: Map<string, Neighbor[]>,
  groups: Map<string, Evidence[]>,
) {
  for (const [start, group] of groups) {
    const visits = searchPaths(neighbors, start, new Set(group.map(({ end }) => end)));
    for (const { end, beep } of group) {
      const mark = beep ? measured : noContinuity;
      // A visited node has the same path back to this root for the whole group.
      for (let visit = visits.get(end); visit?.via; visit = visits.get(visit.via.from)) {
        if (visit.marks & mark) break;
        visit.marks |= mark;
        markLevel(levels[visit.via.id]!, mark);
      }
    }
  }
}

function markFromEndDistances(
  levels: Record<string, ConnectionLevel>,
  neighbors: Map<string, Neighbor[]>,
  groups: Map<string, Evidence[]>,
) {
  for (const [end, group] of groups) {
    const visits = searchPaths(neighbors, end, new Set(group.map(({ start }) => start)));
    for (const { start, beep } of group) {
      const mark = beep ? measured : noContinuity;
      let from = start;
      for (let visit = visits.get(from); visit?.distance; visit = visits.get(from)) {
        if (visit.marks & mark) break;
        const nextDistance = visit.distance - 1;
        // Distances come from B, but ties are still decided by edge IDs from A.
        const edge = neighbors
          .get(from)
          ?.find(
            ({ to, junction }) =>
              (junction || to === end) && visits.get(to)?.distance === nextDistance,
          );
        if (!edge) break;
        visit.marks |= mark;
        markLevel(levels[edge.id]!, mark);
        from = edge.to;
      }
    }
  }
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
  const { byStart, byEnd } = groupSearches(evidence);
  markFromStartTrees(levels, neighbors, byStart);
  markFromEndDistances(levels, neighbors, byEnd);
  return levels;
}
