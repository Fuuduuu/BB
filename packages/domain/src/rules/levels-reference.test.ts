import { expect, test } from 'vitest';
import { newBoardDoc } from '../doc';
import type { BoardDoc } from '../model/board';
import type { EndRef, MeasuredPin } from '../model/primitives';
import { connectionLevels } from './index';
import { endKey, pinKey } from './nets';

// Reference implementation from e140f7f. Keep its path search and evidence rules independent.
type ConnectionLevel = {
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

function referenceConnectionLevels(doc: BoardDoc): Record<string, ConnectionLevel> {
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

function graph(pinCount: number, junctionCount: number) {
  const doc = newBoardDoc('Sünteetiline tasemete võrdlus');
  const pins = Array.from({ length: pinCount }, (_, index) => ({
    id: 'p' + String(index).padStart(3, '0'),
    uid: 'pin_' + index,
    nc: false,
  }));
  doc.components.push({
    id: 'cmp_board',
    ref: 'U1',
    kind: 'connector',
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins,
  });
  doc.junctions = Array.from({ length: junctionCount }, (_, index) => ({ id: 'jun_' + index }));
  const probe = (index: number): MeasuredPin => ({
    c: 'cmp_board',
    p: pins[index]!.id,
    uid: pins[index]!.uid,
  });
  const pin = (index: number): EndRef => ({ pin: { c: 'cmp_board', p: pins[index]!.id } });
  const junction = (index: number): EndRef => ({ junction: doc.junctions[index]!.id });

  function connect(a: EndRef, b: EndRef, options: { id?: string; assumed?: boolean } = {}) {
    doc.connections.push({
      id: options.id ?? 'con_' + String(doc.connections.length).padStart(4, '0'),
      a,
      b,
      basis: options.assumed ? 'assumed' : 'visual',
    });
  }

  function measure(a: number, b: number, beep: boolean, seconds = 0) {
    doc.measurements.push({
      id: 'msr_' + doc.measurements.length,
      mode: 'continuity',
      at: probe(a),
      ref: probe(b),
      atLabel: 'U1.' + pins[a]!.id,
      refLabel: 'U1.' + pins[b]!.id,
      beep,
      power: 'off',
      takenAt: '2026-11-21T12:00:' + String(seconds).padStart(2, '0') + '.000Z',
      source: 'manual',
    });
  }
  return { doc, pin, junction, connect, measure };
}

function randomGraph(seed: number): BoardDoc {
  let state = seed;
  const pick = (count: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 2 ** 32) * count);
  };
  const pinCount = 7 + pick(9);
  const junctionCount = 3 + pick(12);
  const { doc, pin, junction, connect, measure } = graph(pinCount, junctionCount);
  // Keep a real junction cycle and parallel edges even on sparse seeds.
  connect(junction(0), junction(1));
  connect(junction(1), junction(2));
  connect(junction(2), junction(0));
  connect(junction(0), junction(1), { assumed: true });
  for (let index = 0; index < pinCount; index++) {
    connect(pin(index), junction(pick(junctionCount)), { assumed: pick(2) === 1 });
  }

  const end = (index: number) => (index < pinCount ? pin(index) : junction(index - pinCount));
  const nodeCount = pinCount + junctionCount;
  for (let count = pick(3 * nodeCount); count > 0; count--) {
    const from = pick(nodeCount);
    const to = pick(nodeCount - 1);
    connect(end(from), end(to >= from ? to + 1 : to), { assumed: pick(2) === 1 });
  }

  const anchor = pick(pinCount);
  for (let target = 0; target < pinCount; target++) {
    if (target !== anchor) measure(anchor, target, pick(2) === 1, pick(3));
  }
  for (let count = 2 * pinCount; count > 0; count--) {
    const from = pick(pinCount);
    const to = pick(pinCount - 1);
    measure(from, to >= from ? to + 1 : to, pick(2) === 1, pick(3));
  }

  for (let index = doc.connections.length - 1; index > 0; index--) {
    const other = pick(index + 1);
    [doc.connections[index], doc.connections[other]] = [
      doc.connections[other]!,
      doc.connections[index]!,
    ];
  }
  return doc;
}

function directionalTie(anchor: 0 | 2): BoardDoc {
  const { doc, pin, junction, connect, measure } = graph(3, 2);
  connect(pin(2), junction(1), { id: 'con_c_exit' });
  connect(pin(2), junction(0), { id: 'con_z_exit' });
  connect(pin(0), junction(1), { id: 'con_b_enter' });
  connect(pin(0), junction(0), { id: 'con_a_enter' });
  connect(pin(1), junction(0), { id: 'con_a_other' });
  connect(pin(1), junction(1), { id: 'con_b_other' });
  measure(anchor, 2 - anchor, true);
  measure(anchor, 1, false);
  return doc;
}

function sameAnchor(topology: 'chain' | 'star', last: boolean): BoardDoc {
  const branches = 500;
  const { doc, pin, junction, connect, measure } = graph(branches + 1, branches);
  const anchor = last ? branches : 0;
  connect(pin(anchor), junction(0));
  for (let index = 0; index < branches; index++) {
    if (index > 0) {
      connect(junction(topology === 'chain' ? index - 1 : 0), junction(index));
    }
    const target = last ? index : index + 1;
    connect(junction(index), pin(target));
    measure(anchor, target, index % 2 === 0);
  }
  return doc;
}

test('levels_match_reference_on_random_graphs', () => {
  for (let seed = 1; seed <= 600; seed++) {
    const doc = randomGraph(seed);
    expect(connectionLevels(doc), 'seed ' + seed).toStrictEqual(referenceConnectionLevels(doc));
  }
  for (const anchor of [0, 2] as const) {
    const doc = directionalTie(anchor);
    expect(connectionLevels(doc), 'directional tie, anchor ' + anchor).toStrictEqual(
      referenceConnectionLevels(doc),
    );
  }
  for (const topology of ['chain', 'star'] as const) {
    for (const last of [false, true]) {
      const doc = sameAnchor(topology, last);
      expect(connectionLevels(doc), topology + ', anchor last: ' + last).toStrictEqual(
        referenceConnectionLevels(doc),
      );
    }
  }
});
