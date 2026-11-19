import type { BoardDoc } from '../model/board';
import type { EndRef, PinRef } from '../model/primitives';

export const pinKey = (ref: PinRef): string => `${ref.c}:${ref.p}`;
export const endKey = (end: EndRef): string => ('pin' in end ? pinKey(end.pin) : end.junction);

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
  for (const { id } of doc.junctions) ends.set(id, { junction: id });
  return ends;
}

export function resolveNets(doc: BoardDoc): NetMembership {
  const keys = [...endRefsByKey(doc).keys()].sort();
  const parents = new Map(keys.map((key) => [key, key]));

  function root(key: string): string {
    let parent = parents.get(key)!;
    while (parent !== key) {
      const grandparent = parents.get(parent)!;
      parents.set(key, grandparent);
      key = parent;
      parent = grandparent;
    }
    return key;
  }

  for (const connection of doc.connections) {
    const left = endKey(connection.a);
    const right = endKey(connection.b);
    if (!parents.has(left) || !parents.has(right)) continue;
    const a = root(left);
    const b = root(right);
    if (a < b) parents.set(b, a);
    else if (b < a) parents.set(a, b);
  }

  const netOf = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const key of keys) {
    const net = root(key);
    netOf.set(key, net);
    const group = members.get(net);
    if (group) group.push(key);
    else members.set(net, [key]);
  }
  return { netOf, members };
}
