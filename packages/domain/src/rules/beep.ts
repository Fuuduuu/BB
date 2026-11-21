import type { BoardDoc } from '../model/board';
import type { PinRef } from '../model/primitives';
import { RuleRejected } from './errors';
import { isShortableKind, shortedComponents } from './net-info';
import { createNetConnectivity, endKey, pinKey } from './nets';

export type BeepOutcome =
  | { kind: 'connected' }
  | { kind: 'same_net' }
  | {
      kind: 'guarded';
      reason: 'same_component' | 'shorts_component' | 'role_conflict';
      components: string[];
      roles: string[];
    };

export function connectBeepPins(
  doc: BoardDoc,
  { anchor, pin, connectionId }: { anchor: PinRef; pin: PinRef; connectionId: string },
): BeepOutcome {
  const { find, union } = createNetConnectivity(doc);
  const anchorKey = pinKey(anchor);
  const pinContactKey = pinKey(pin);
  const anchorNet = find(anchorKey);
  const pinNet = find(pinContactKey);
  if (anchorNet === undefined || pinNet === undefined) throw new RuleRejected('pin_not_active');
  if (anchorNet === pinNet) return { kind: 'same_net' };

  if (anchor.c === pin.c) {
    const component = doc.components.find(({ id }) => id === anchor.c);
    if (
      component?.pins.length === 2 &&
      (isShortableKind(component.kind) || component.kind === 'switch')
    ) {
      return {
        kind: 'guarded',
        reason: 'same_component',
        components: [component.ref],
        roles: [],
      };
    }
  }

  // Keep roles of the original nets before tentatively joining their roots.
  const anchorRoles = new Set<string>();
  const pinRoles = new Set<string>();
  for (const label of doc.netLabels) {
    if (label.roleId === undefined) continue;
    const net = find(endKey(label.anchor));
    if (net === anchorNet) anchorRoles.add(label.roleId);
    else if (net === pinNet) pinRoles.add(label.roleId);
  }

  const existingShorts = new Set(shortedComponents(doc.components, find));
  union(anchorKey, pinContactKey);
  const newShorts = new Set(
    shortedComponents(doc.components, find).filter((id) => !existingShorts.has(id)),
  );
  if (newShorts.size > 0) {
    const components = doc.components
      .filter(({ id }) => newShorts.has(id))
      .map(({ ref }) => ref)
      .sort();
    return { kind: 'guarded', reason: 'shorts_component', components, roles: [] };
  }

  const mergedRoles = new Set([...anchorRoles, ...pinRoles]);
  if (anchorRoles.size > 0 && pinRoles.size > 0 && mergedRoles.size > 1) {
    const roles = doc.roles
      .filter(({ id }) => mergedRoles.has(id))
      .map(({ label }) => label)
      .sort();
    return { kind: 'guarded', reason: 'role_conflict', components: [], roles };
  }

  doc.connections.push({ id: connectionId, a: { pin: anchor }, b: { pin }, basis: 'assumed' });
  return { kind: 'connected' };
}
