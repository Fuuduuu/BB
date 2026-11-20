import type { BoardDoc } from '../model/board';
import type { Component } from '../model/component';
import type { NetLabel } from '../model/net';
import { endKey, pinKey, resolveNets } from './nets';

export interface NetInfo {
  key: string;
  members: string[];
  name: string;
  named: boolean;
  roleId?: string;
  roleConflict: boolean;
  conflictingRoles: string[];
  beepContradiction: boolean;
}

export interface NetsDerived {
  list: NetInfo[];
  netOf: Record<string, string>;
  shortedComponents: string[];
}

const shortableKinds = new Set<Component['kind']>([
  'resistor',
  'capacitor',
  'capacitor_polarized',
  'inductor',
  'diode',
  'led',
  'zener',
  'fuse',
  'crystal',
]);

function labelsByAnchor(netLabels: readonly NetLabel[]): Map<string, NetLabel[]> {
  const byAnchor = new Map<string, NetLabel[]>();
  for (const label of netLabels) {
    const key = endKey(label.anchor);
    const group = byAnchor.get(key);
    if (group) group.push(label);
    else byAnchor.set(key, [label]);
  }
  return byAnchor;
}

function contradictionNets(doc: BoardDoc, netOf: ReadonlyMap<string, string>): Set<string> {
  const pinUids = new Map<string, string>();
  for (const { id, pins } of doc.components) {
    for (const pin of pins) pinUids.set(pinKey({ c: id, p: pin.id }), pin.uid);
  }

  const contradictions = new Set<string>();
  for (const { mode, beep, at, ref } of doc.measurements) {
    if (mode !== 'continuity' || beep !== false || !ref) continue;
    const left = pinKey(at);
    const right = pinKey(ref);
    if (pinUids.get(left) !== at.uid || pinUids.get(right) !== ref.uid) continue;
    const key = netOf.get(left);
    if (key !== undefined && key === netOf.get(right)) contradictions.add(key);
  }
  return contradictions;
}

function shortedComponents(
  components: readonly Component[],
  netOf: ReadonlyMap<string, string>,
): string[] {
  const shorted: string[] = [];
  for (const { id, kind, pins } of components) {
    if (pins.length !== 2 || !shortableKinds.has(kind)) continue;
    const first = netOf.get(pinKey({ c: id, p: pins[0]!.id }));
    const second = netOf.get(pinKey({ c: id, p: pins[1]!.id }));
    if (first !== undefined && first === second) shorted.push(id);
  }
  return shorted.sort();
}

export function describeNets(doc: BoardDoc): NetsDerived {
  const membership = resolveNets(doc);
  const labels = labelsByAnchor(doc.netLabels);
  const contradictions = contradictionNets(doc, membership.netOf);
  const list: NetInfo[] = [];
  const visibleMembership: [string, string][] = [];
  let unnamed = 0;

  // resolveNets sorts both the network keys and the member keys.
  for (const [key, members] of membership.members) {
    const netLabels = members.flatMap((member) => labels.get(member) ?? []);
    if (members.length < 2 && netLabels.length === 0) continue;
    const name = netLabels.find((label) => label.name)?.name;
    const roles = [...new Set(netLabels.flatMap(({ roleId }) => (roleId ? [roleId] : [])))].sort();
    const roleConflict = roles.length > 1;
    list.push({
      key,
      members: [...members],
      name: name ?? `N${++unnamed}`,
      named: name !== undefined,
      ...(roles.length === 1 ? { roleId: roles[0]! } : {}),
      roleConflict,
      conflictingRoles: roleConflict ? roles : [],
      beepContradiction: contradictions.has(key),
    });
    for (const member of members) visibleMembership.push([member, key]);
  }

  return {
    list,
    netOf: Object.fromEntries(visibleMembership),
    shortedComponents: shortedComponents(doc.components, membership.netOf),
  };
}
