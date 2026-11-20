import type { BoardDoc } from '../model/board';
import type { EndRef, PinRef } from '../model/primitives';

const escapeId = (id: string): string => id.replace(/[:\\]/g, '\\$&');
export const pinKey = (ref: PinRef): string => `${escapeId(ref.c)}:${escapeId(ref.p)}`;
export const endKey = (end: EndRef): string =>
  'pin' in end ? pinKey(end.pin) : escapeId(end.junction);

export interface NetMembership {
  netOf: ReadonlyMap<string, string>;
  members: ReadonlyMap<string, readonly string[]>;
}

export function endRefsByKey(doc: BoardDoc): ReadonlyMap<string, EndRef> {
  const ends = new Map<string, EndRef>();
  for (const component of doc.components) {
    for (const pin of component.pins) {
      const ref = { c: component.id, p: pin.id };
      ends.set(pinKey(ref), { pin: ref });
    }
  }
  for (const { id } of doc.junctions) {
    const end = { junction: id };
    ends.set(endKey(end), end);
  }
  return ends;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function legacyOrder(endpoints: ReadonlyMap<string, EndRef>) {
  // Keep the original network order when escaping would otherwise move an ID.
  const sortKeys = new Map<string, string>();
  for (const [key, end] of endpoints) {
    if (key.includes('\\')) {
      sortKeys.set(key, 'pin' in end ? `${end.pin.c}:${end.pin.p}` : end.junction);
    }
  }
  if (!sortKeys.size) return undefined;
  return (a: string, b: string) =>
    compareText(sortKeys.get(a) ?? a, sortKeys.get(b) ?? b) || compareText(a, b);
}

export function createNetConnectivity(doc: BoardDoc, endpoints = endRefsByKey(doc)) {
  const order = legacyOrder(endpoints);
  const keys: readonly string[] = [...endpoints.keys()].sort(order);
  const compare = order ?? compareText;
  const parents = new Map(keys.map((key) => [key, key]));

  function find(key: string): string | undefined {
    const initialParent = parents.get(key);
    if (initialParent === undefined) return undefined;
    let parent = initialParent;
    while (parent !== key) {
      const grandparent = parents.get(parent)!;
      parents.set(key, grandparent);
      key = parent;
      parent = grandparent;
    }
    return key;
  }

  function union(left: string, right: string): void {
    const a = find(left);
    const b = find(right);
    if (a === undefined || b === undefined || a === b) return;
    if (compare(a, b) < 0) parents.set(b, a);
    else parents.set(a, b);
  }

  for (const { a, b } of doc.connections) union(endKey(a), endKey(b));
  return { keys, find, union };
}

export function resolveNets(doc: BoardDoc): NetMembership {
  const { keys, find } = createNetConnectivity(doc);
  const netOf = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const key of keys) {
    const net = find(key)!;
    netOf.set(key, net);
    const group = members.get(net);
    if (group) group.push(key);
    else members.set(net, [key]);
  }
  return { netOf, members };
}
